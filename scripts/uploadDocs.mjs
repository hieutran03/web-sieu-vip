// Uploads catalogued documents to Cloudinary and writes the delivery URLs back into
// src/data/documentCatalog.json.
//
//   npm run docs:upload                          # everything uploadable that is not uploaded yet
//   npm run docs:upload -- --only=industrial-zones,zone-geology
//   npm run docs:upload -- --limit=20 --dry-run
//   npm run docs:upload -- --force               # re-upload even if already recorded
//
// Files above the plan limits (10 MB raw/image, 100 MB video) are skipped and stay flagged
// `uploadable: false` in the catalog, so the UI can still list them as share-only documents.

import fs from "node:fs/promises";
import path from "node:path";
import { assertCloudinaryConfigured, uploadBuffer, usage } from "../server/cloudinary.mjs";
import { buildContext, buildPublicId, buildTags } from "../server/documentKeys.mjs";
import { loadEnv, REPO_ROOT } from "./lib/env.mjs";

loadEnv();

const CATALOG = path.join(REPO_ROOT, "src", "data", "documentCatalog.json");
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 3;

function parseArgs(argv) {
  const options = { only: null, limit: Infinity, dryRun: false, force: false, category: null };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg.startsWith("--only=")) options.only = arg.slice(7).split(",").filter(Boolean);
    else if (arg.startsWith("--category=")) options.category = arg.slice(11).split(",").filter(Boolean);
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice(8));
  }
  return options;
}

async function runPool(items, worker, concurrency) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function uploadOne(doc, sourceRoot) {
  const fullPath = path.join(sourceRoot, doc.relPath.split("/").join(path.sep));
  const buffer = await fs.readFile(fullPath);
  const publicId = buildPublicId(doc);

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await uploadBuffer({
        buffer,
        fileName: doc.fileName,
        publicId,
        resourceType: doc.resourceType,
        tags: buildTags(doc),
        context: buildContext(doc)
      });
      return {
        publicId: result.public_id,
        resourceType: result.resource_type,
        version: result.version,
        format: result.format ?? null,
        bytes: result.bytes ?? buffer.length,
        secureUrl: result.secure_url,
        pages: result.pages ?? null,
        width: result.width ?? null,
        height: result.height ?? null,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      lastError = error;
      const message = String(error.message ?? error);
      // Plan limits and unsupported formats will never succeed on retry.
      if (/File size too large|maximum is|not allowed|Unsupported/i.test(message)) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertCloudinaryConfigured();

  const catalog = JSON.parse(await fs.readFile(CATALOG, "utf8"));
  const sourceRoot = process.env.DOCS_SOURCE_DIR ?? catalog.sourceRoot;

  const pending = catalog.documents.filter((doc) => {
    if (!doc.uploadable) return false;
    if (!options.force && doc.cloudinary?.secureUrl) return false;
    if (options.only && !options.only.includes(doc.collection)) return false;
    if (options.category && !options.category.includes(doc.category)) return false;
    return true;
  });
  const queue = pending.slice(0, Number.isFinite(options.limit) ? options.limit : pending.length);

  const skipped = catalog.documents.filter((doc) => !doc.uploadable);
  const alreadyUploaded = catalog.documents.filter((doc) => doc.cloudinary?.secureUrl).length;
  process.stdout.write(
    `${queue.length} file(s) to upload (${(queue.reduce((sum, doc) => sum + doc.sizeBytes, 0) / 1024 / 1024).toFixed(1)} MB), ` +
      `${skipped.length} over plan limit, ${alreadyUploaded} already hosted\n`
  );

  if (options.dryRun) {
    for (const doc of queue.slice(0, 25)) {
      process.stdout.write(`  ${doc.resourceType.padEnd(5)} ${buildPublicId(doc)}\n`);
    }
    return;
  }

  const failures = [];
  let done = 0;

  await runPool(
    queue,
    async (doc) => {
      try {
        doc.cloudinary = await uploadOne(doc, sourceRoot);
        done += 1;
        process.stdout.write(`[${done}/${queue.length}] ${doc.cloudinary.publicId}\n`);
      } catch (error) {
        failures.push({ id: doc.id, relPath: doc.relPath, error: String(error.message ?? error) });
        process.stderr.write(`FAIL ${doc.relPath}: ${error.message ?? error}\n`);
      }
      // Persist as we go so a crash or Ctrl+C never loses completed uploads.
      if (done % 20 === 0) await fs.writeFile(CATALOG, JSON.stringify(catalog, null, 1), "utf8");
    },
    CONCURRENCY
  );

  catalog.uploadedAt = new Date().toISOString();
  catalog.summary.uploaded = catalog.documents.filter((doc) => doc.cloudinary?.secureUrl).length;
  await fs.writeFile(CATALOG, JSON.stringify(catalog, null, 1), "utf8");

  if (failures.length) {
    const reportPath = path.join(REPO_ROOT, "src", "data", "uploadFailures.json");
    await fs.writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), failures }, null, 1), "utf8");
    process.stdout.write(`\n${failures.length} failure(s) written to ${path.relative(REPO_ROOT, reportPath)}\n`);
  }

  const plan = await usage();
  process.stdout.write(
    `\nUploaded ${done}/${queue.length}. Catalog now has ${catalog.summary.uploaded} hosted documents.\n` +
      `Cloudinary credits: ${plan.credits?.usage ?? "?"}/${plan.credits?.limit ?? "?"} (storage ${((plan.storage?.usage ?? 0) / 1024 / 1024).toFixed(0)} MB)\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
