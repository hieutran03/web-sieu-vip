// Uploads catalogued documents that no store hosts yet (the reports above the Cloudinary plan
// limits) to the self-hosted store, and records `selfhost` in src/data/documentCatalog.json.
// Files are streamed from the share, never loaded whole into memory.
//
//   npm run docs:upload-selfhost                       # every document that is not hosted anywhere
//   npm run docs:upload-selfhost -- --dry-run
//   npm run docs:upload-selfhost -- --limit=3
//   npm run docs:upload-selfhost -- --include-imagekit # also move the ImageKit-hosted reports
//   npm run docs:upload-selfhost -- --force            # re-upload documents already on the store
//   npm run docs:upload-selfhost -- --path="N1-Địa chất Việt Nam/"  # only documents under this relPath prefix

import fs from "node:fs/promises";
import path from "node:path";
import { isHosted } from "../src/shared/catalogStats.js";
import { assertSelfStorageConfigured, selfhostRecord, storageHealth, storageKey, storageMeta, uploadFile } from "../server/selfStorage.mjs";
import { loadEnv, REPO_ROOT } from "./lib/env.mjs";

loadEnv();

const CATALOG = path.join(REPO_ROOT, "src", "data", "documentCatalog.json");
const MAX_ATTEMPTS = 3;

function parseArgs(argv) {
  const options = { dryRun: false, force: false, includeImagekit: false, limit: Infinity };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--include-imagekit") options.includeImagekit = true;
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice(8));
    else if (arg.startsWith("--path=")) options.pathPrefix = arg.slice(7).normalize("NFC");
  }
  return options;
}

function wanted(doc, options) {
  if (options.pathPrefix && !doc.relPath.normalize("NFC").startsWith(options.pathPrefix)) return false;
  if (doc.selfhost?.key) return options.force;
  if (!isHosted(doc)) return true;
  // Hosted only on ImageKit (whose free plan has its own caps): optionally move it here too.
  return options.includeImagekit && Boolean(doc.imagekit?.url) && !doc.cloudinary?.secureUrl;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function uploadOne(doc, sourceRoot) {
  const filePath = path.join(sourceRoot, ...doc.relPath.split("/"));
  const key = storageKey(doc);
  let lastPrinted = 0;

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await uploadFile({
        filePath,
        key,
        meta: storageMeta(doc),
        onProgress: (sent, total) => {
          const percent = Math.floor((sent / total) * 100);
          if (percent >= lastPrinted + 10) {
            lastPrinted = percent;
            process.stdout.write(`    ${percent}% of ${mb(total)}\n`);
          }
        }
      });
      return selfhostRecord(result.key, result.bytes, result.uploadedAt);
    } catch (error) {
      lastError = error;
      if (error.code === "ENOENT" || /signature|too large|Invalid key/i.test(String(error.message))) break;
      lastPrinted = 0;
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
  throw lastError;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertSelfStorageConfigured();

  const catalog = JSON.parse(await fs.readFile(CATALOG, "utf8"));
  const sourceRoot = process.env.DOCS_SOURCE_DIR ?? catalog.sourceRoot;
  const pending = catalog.documents.filter((doc) => wanted(doc, options)).sort((a, b) => a.sizeBytes - b.sizeBytes);
  const queue = pending.slice(0, Number.isFinite(options.limit) ? options.limit : pending.length);
  const totalBytes = queue.reduce((sum, doc) => sum + doc.sizeBytes, 0);

  process.stdout.write(`${queue.length} file(s) to upload (${mb(totalBytes)})\n`);
  if (options.dryRun) {
    for (const doc of queue) process.stdout.write(`  ${mb(doc.sizeBytes).padStart(10)}  ${storageKey(doc)}\n`);
    return;
  }

  const health = await storageHealth();
  if (health.freeBytes !== null && health.freeBytes < totalBytes) {
    throw new Error(`Storage server has only ${mb(health.freeBytes)} free, ${mb(totalBytes)} needed`);
  }

  const failures = [];
  let done = 0;
  for (const doc of queue) {
    process.stdout.write(`[${done + failures.length + 1}/${queue.length}] ${doc.relPath} (${mb(doc.sizeBytes)})\n`);
    try {
      doc.selfhost = await uploadOne(doc, sourceRoot);
      done += 1;
      // Persist after each file: these uploads are long, an interruption must not lose any.
      await fs.writeFile(CATALOG, JSON.stringify(catalog, null, 1), "utf8");
    } catch (error) {
      failures.push({ id: doc.id, relPath: doc.relPath, error: String(error.message ?? error) });
      process.stderr.write(`FAIL ${doc.relPath}: ${error.message ?? error}\n`);
    }
  }

  catalog.uploadedAt = new Date().toISOString();
  await fs.writeFile(CATALOG, JSON.stringify(catalog, null, 1), "utf8");

  process.stdout.write(`\nUploaded ${done}/${queue.length}. Catalog now has ${catalog.documents.filter(isHosted).length} hosted documents.\n`);
  if (failures.length) {
    for (const failure of failures) process.stderr.write(`  ${failure.relPath}: ${failure.error}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
