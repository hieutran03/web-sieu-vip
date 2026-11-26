import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { inSiteScope } from "../src/shared/scope.js";
import { classifyDocument } from "../src/shared/classify.js";
import { buildStats, filterDocuments, mergeHosting } from "../src/shared/catalogStats.js";
import { readRoute, resolveCatalogRoute } from "../src/lib/routes.js";
import { DISTRICT_LOCATIONS } from "../src/data/districtLocations.js";

const catalog = JSON.parse(fs.readFileSync(new URL("../src/data/documentCatalog.json", import.meta.url), "utf8"));
const docs = catalog.documents;
const root = ["N1-Địa chất Việt Nam", "R1.2. Địa chất  KCN miền Nam"];

test("catalog contains only the current source, excluding OLD", () => {
  assert.ok(docs.length > 0);
  assert.ok(docs.every(inSiteScope));
  assert.equal(new Set(docs.map((doc) => doc.relPath)).size, docs.length);
  assert.equal(inSiteScope({ relPath: `${root.join("/")}/OLD/file.pdf` }), false);
  assert.equal(inSiteScope({ relPath: `${root[0]}/R1.6. Địa chất KCN miền Bắc/A.pdf` }), false);
  assert.equal(inSiteScope({ relPath: `${root.join("/")}/A.pdf`, archived: true }), false);
});

test("source-wide spreadsheet is not assigned to a fabricated location", () => {
  const workbook = docs.find((doc) => doc.fileName === "GEO_Database_KCN_MienNam -TAM.xlsx");
  assert.ok(workbook);
  assert.equal(workbook.category, "dataset");
  assert.equal(workbook.region, "south");
  assert.equal(workbook.provinceSlug, null);
  assert.equal(workbook.zoneSlug, null);
});

test("topography and geological records are classified separately", () => {
  assert.equal(classifyDocument([...root, "Bình Dương", "KCN Bầu Bàng", "1. ĐIA HINH"], "survey.pdf").category, "topography");
  assert.equal(classifyDocument([...root, "Bình Dương", "KCN Bầu Bàng", "2. KHAO SAT DIA CHAT"], "report.pdf").category, "geology");
  assert.equal(classifyDocument([...root, "Bình Phước", "KCN Minh Hưng - CHƯA CÓ KẾT QUẢ THÍ NGHIỆM"], "report.pdf").zoneName, "Minh Hưng");
});

test("filters compose and include project addresses", () => {
  const results = filterDocuments(docs, { region: "south", province: "long-an", zone: "xuyen-a", kind: "pdf", query: "Mỹ Hạnh Bắc" });
  assert.equal(results.length, 1);
  assert.match(results[0].projectLocation.address, /Mỹ Hạnh Bắc/);
  assert.equal(filterDocuments(docs, { region: "north" }).length, 0);
  assert.ok(filterDocuments(docs, { category: "topography", province: "binh-duong" }).length > 0);
  assert.equal(filterDocuments(docs, { category: "dataset", kind: "pdf" }).length, 0);
});

test("statistics use actual hosting status and exclude unlocated datasets from locations", () => {
  const stats = buildStats(docs);
  assert.equal(stats.totals.documents, docs.length);
  assert.equal(stats.totals.unassigned, 1);
  assert.equal(stats.totals.shareOnly, docs.filter((doc) => !doc.selfhost?.key && !doc.imagekit?.url && !doc.cloudinary?.secureUrl).length);
  assert.equal(stats.zones.some((zone) => !zone.provinceSlug), false);
});

test("live data cannot replace a newer local file with an older size", () => {
  const current = { sizeBytes: 100, cloudinary: null };
  assert.equal(mergeHosting(current, { sizeBytes: 99, cloudinary: { secureUrl: "old" } }).cloudinary, null);
  assert.equal(mergeHosting(current, { sizeBytes: 100, cloudinary: { secureUrl: "current" } }).cloudinary.secureUrl, "current");
});

test("old links are reset when their location no longer exists in the catalog", () => {
  const old = readRoute(new URL("https://example.test/map?region=north&province=bac-ninh&zone=vsip"));
  const resolved = resolveCatalogRoute(old, docs, DISTRICT_LOCATIONS);
  assert.equal(resolved.region, null);
  assert.equal(resolved.province, null);
  assert.equal(resolved.zone, null);
  const current = resolveCatalogRoute(readRoute(new URL("https://example.test/map?province=long-an&district=duc-hoa")), docs, DISTRICT_LOCATIONS);
  assert.equal(current.district, "duc-hoa");
});

test("live endpoint can fall back to the catalog when stores are not configured", () => {
  const script = `import { liveDocuments, mergedDocuments } from './server/catalogSource.js';
    const live = await liveDocuments(); const result = await mergedDocuments();
    if (live.length !== 0 || result.documents.length !== ${docs.length} || result.liveError) process.exit(1);`;
  execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, CLOUDINARY_CLOUD_NAME: "", STORAGE_PUBLIC_URL: "", STORAGE_UPLOAD_SECRET: "" }
  });
});
