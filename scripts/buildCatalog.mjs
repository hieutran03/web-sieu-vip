// Scans the documentation share and writes src/data/documentCatalog.json.
//
//   npm run docs:catalog                    # uses DOCS_SOURCE_DIR from .env.local
//   npm run docs:catalog -- "D:\some\dir"   # explicit root
//   npm run docs:catalog -- --all           # keep every collection, not just the industrial zones
//
// Scope: by default only the industrial-zone trees are catalogued — the zone layouts
// (R1.1 Khu công nghiệp) and the geotechnical surveys per zone (R1.2 / R1.6 / R1.8 Địa chất KCN).
// That is what the public site is about; the TNF/TCCS/cement folders stay out of it.
//
// Classification is rule-based (see src/shared/classify.js): region / province / industrial zone
// come from the folder names, document category from folder + file name keywords.
// Existing Cloudinary URLs in the catalog are preserved so a rescan never loses upload state.

import fs from "node:fs/promises";
import path from "node:path";
import { classifyDocument, shouldIgnore } from "../src/shared/classify.js";
import { slugify } from "../src/shared/text.js";
import { loadEnv, REPO_ROOT } from "./lib/env.mjs";

loadEnv();

const OUTPUT = path.join(REPO_ROOT, "src", "data", "documentCatalog.json");
const MAX_DEPTH = 12;
const ZONE_COLLECTIONS = new Set(["industrial-zones", "zone-geology"]);
// Cloudinary free plan ceilings; anything larger stays on the share and is flagged in the UI.
const LIMITS = { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024, raw: 10 * 1024 * 1024 };

function resourceTypeOf(kind) {
  // PDFs go in as `image` so Cloudinary can render page-1 thumbnails for the zone cards.
  if (kind === "image" || kind === "pdf") return "image";
  if (kind === "video") return "video";
  return "raw";
}

function sizeLimitFor(kind) {
  return LIMITS[resourceTypeOf(kind)];
}

/**
 * Readable title: drop the extension and tidy separators, but keep the leading numbering
 * (`01.`, `1.3`) because it carries the ordering used in the source folders.
 */
function titleOf(fileName) {
  return fileName
    .replace(/\.[A-Za-z0-9]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function walk(root) {
  const files = [];
  const stack = [{ dir: root, segments: [] }];

  while (stack.length) {
    const { dir, segments } = stack.pop();
    if (segments.length > MAX_DEPTH) continue;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      process.stderr.write(`skip ${dir}: ${error.code ?? error.message}\n`);
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith("~$")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push({ dir: fullPath, segments: [...segments, entry.name] });
        continue;
      }
      if (!entry.isFile() || shouldIgnore(entry.name)) continue;

      let stats;
      try {
        stats = await fs.stat(fullPath);
      } catch {
        continue;
      }
      files.push({ fullPath, segments, fileName: entry.name, size: stats.size, modifiedAt: stats.mtime.toISOString() });
    }
  }

  return files;
}

async function readExistingCatalog() {
  try {
    const raw = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
    return new Map((raw.documents ?? []).map((doc) => [doc.id, doc]));
  } catch {
    return new Map();
  }
}

function summarize(documents) {
  const tally = (key) =>
    documents.reduce((acc, doc) => {
      const value = doc[key] ?? "unassigned";
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});

  return {
    total: documents.length,
    totalBytes: documents.reduce((sum, doc) => sum + doc.sizeBytes, 0),
    uploadable: documents.filter((doc) => doc.uploadable).length,
    tooLarge: documents.filter((doc) => !doc.uploadable).length,
    byRegion: tally("region"),
    byProvince: tally("provinceSlug"),
    byCategory: tally("category"),
    byCollection: tally("collection"),
    byKind: tally("kind"),
    zones: new Set(documents.filter((doc) => doc.zoneSlug).map((doc) => `${doc.provinceSlug}/${doc.zoneSlug}`)).size
  };
}

async function main() {
  const args = process.argv.slice(2);
  const keepEverything = args.includes("--all");
  const sourceRoot = args.find((arg) => !arg.startsWith("--")) ?? process.env.DOCS_SOURCE_DIR;
  if (!sourceRoot) throw new Error("Set DOCS_SOURCE_DIR in .env.local or pass the folder as an argument.");

  await fs.access(sourceRoot);
  process.stdout.write(`Scanning ${sourceRoot}\n`);

  const existing = await readExistingCatalog();
  const files = await walk(sourceRoot);
  files.sort((a, b) => [...a.segments, a.fileName].join("/").localeCompare([...b.segments, b.fileName].join("/")));

  const allDocuments = files.map((file) => {
    const relPath = [...file.segments, file.fileName].join("/");
    const id = slugify(relPath).slice(0, 120) + "-" + Math.abs(hashCode(relPath)).toString(36);
    const classification = classifyDocument(file.segments, file.fileName);
    const previous = existing.get(id);
    const changed = previous ? previous.sizeBytes !== file.size || previous.modifiedAt !== file.modifiedAt : false;

    return {
      id,
      relPath,
      folder: file.segments.join("/"),
      fileName: file.fileName,
      title: titleOf(file.fileName),
      sizeBytes: file.size,
      modifiedAt: file.modifiedAt,
      ...classification,
      resourceType: resourceTypeOf(classification.kind),
      uploadable: file.size <= sizeLimitFor(classification.kind),
      sizeLimit: sizeLimitFor(classification.kind),
      // Upload state survives rescans unless the file itself changed.
      cloudinary: changed ? null : previous?.cloudinary ?? null,
      source: "share"
    };
  });

  // A document only belongs on the site when it can be placed on the map: an industrial zone in a
  // known province. Anything else (nationwide atlases, TNF/TCCS packages) is skipped.
  const documents = keepEverything
    ? allDocuments
    : allDocuments.filter((doc) => ZONE_COLLECTIONS.has(doc.collection) && doc.provinceSlug && doc.zoneSlug);

  const catalog = {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    scope: keepEverything ? "all" : "industrial-zones",
    skipped: allDocuments.length - documents.length,
    summary: summarize(documents),
    documents
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(catalog, null, 1), "utf8");

  const { summary } = catalog;
  process.stdout.write(
    [
      `\n${summary.total} documents in scope (${catalog.scope}), ${catalog.skipped} skipped, ${(summary.totalBytes / 1024 / 1024).toFixed(0)} MB`,
      `uploadable now: ${summary.uploadable}, too large for the plan: ${summary.tooLarge}`,
      `industrial zones detected: ${summary.zones}`,
      `regions: ${JSON.stringify(summary.byRegion)}`,
      `categories: ${JSON.stringify(summary.byCategory)}`,
      `-> ${path.relative(REPO_ROOT, OUTPUT)}\n`
    ].join("\n")
  );
}

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
