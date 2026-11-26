// Upload unhosted southern PDF reports to ImageKit, preserving each successful URL.
import fs from "node:fs/promises";
import path from "node:path";
import { loadEnv, REPO_ROOT, requireEnv } from "./lib/env.mjs";

loadEnv();
const [privateKey, sourceRoot] = requireEnv("IMAGEKIT_PRIVATE_KEY", "DOCS_SOURCE_DIR");
const catalogPath = path.join(REPO_ROOT, "src/data/documentCatalog.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const prefix = "N1-Địa chất Việt Nam/R1.2. Địa chất  KCN miền Nam/";
const queue = catalog.documents.filter((doc) => doc.relPath.startsWith(prefix) && doc.kind === "pdf" && !doc.cloudinary?.secureUrl && !doc.imagekit?.url).sort((a, b) => a.sizeBytes - b.sizeBytes);
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const selected = limitArg ? queue.slice(0, Number(limitArg.slice(8))) : queue;
let succeeded = 0;
let failed = 0;
for (const doc of selected) {
  try {
    const content = await fs.readFile(path.join(sourceRoot, ...doc.relPath.split("/")));
    const form = new FormData();
    form.append("file", new Blob([content], { type: "application/pdf" }), `${doc.id}.pdf`);
    form.append("fileName", `${doc.id}.pdf`);
    form.append("folder", `/v-tnf/zone-geology/south/${doc.provinceSlug}/${doc.zoneSlug}`);
    form.append("useUniqueFileName", "false");
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
      body: form
    });
    const result = await response.json();
    if (!response.ok || !result.url) throw new Error(result.message || `HTTP ${response.status}`);
    doc.imagekit = { fileId: result.fileId, url: result.url, uploadedAt: new Date().toISOString() };
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 1) + "\n", "utf8");
    succeeded++;
    process.stdout.write(`OK ${doc.fileName}\n`);
  } catch (error) {
    failed++;
    process.stderr.write(`FAIL ${doc.fileName}: ${error.message}\n`);
  }
}
process.stdout.write(`Uploaded ${succeeded}/${selected.length} files.\n`);
if (failed) process.exitCode = 1;
