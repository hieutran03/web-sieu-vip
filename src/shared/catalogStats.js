// Analytics derived from the document catalog. Pure functions, no I/O: the charts in the app,
// /api/analyze and the MCP server all read the same numbers, so nothing is hard-coded any more.

import { CATEGORIES } from "./classify.js";
import { PROVINCE_BY_SLUG, REGIONS } from "./provinceMeta.js";

const ZONE_COVERAGE_CATEGORIES = { map: ["zone-map", "zone-profile"], geology: ["geology"] };

function increment(target, key, amount = 1) {
  if (!key) return;
  target[key] = (target[key] ?? 0) + amount;
}

function sortedEntries(record, limit) {
  const entries = Object.entries(record).sort((a, b) => b[1] - a[1]);
  return limit ? entries.slice(0, limit) : entries;
}

export function isHosted(doc) {
  return Boolean(doc.cloudinary?.secureUrl);
}

/** Group documents into zones: `province/zone` is the identity used across the app. */
export function buildZones(documents) {
  const zones = new Map();
  for (const doc of documents) {
    if (!doc.zoneSlug) continue;
    const key = `${doc.provinceSlug ?? "unassigned"}/${doc.zoneSlug}`;
    if (!zones.has(key)) {
      zones.set(key, {
        key,
        zoneSlug: doc.zoneSlug,
        zoneName: doc.zoneName ?? doc.zoneSlug,
        provinceSlug: doc.provinceSlug ?? null,
        provinceName: doc.provinceName ?? null,
        region: doc.region ?? null,
        archived: doc.archived === true,
        documents: [],
        categories: {},
        kinds: {},
        collections: {}
      });
    }
    const zone = zones.get(key);
    zone.documents.push(doc);
    increment(zone.categories, doc.category);
    increment(zone.kinds, doc.kind);
    increment(zone.collections, doc.collection);
    zone.archived = zone.archived && doc.archived === true;
  }

  for (const zone of zones.values()) {
    zone.documentCount = zone.documents.length;
    zone.hostedCount = zone.documents.filter(isHosted).length;
    zone.sizeBytes = zone.documents.reduce((sum, doc) => sum + (doc.sizeBytes ?? 0), 0);
    zone.hasMap = ZONE_COVERAGE_CATEGORIES.map.some((category) => zone.categories[category] > 0);
    zone.hasGeology = ZONE_COVERAGE_CATEGORIES.geology.some((category) => zone.categories[category] > 0);
    zone.coverage = zone.hasMap && zone.hasGeology ? "complete" : zone.hasMap ? "map-only" : zone.hasGeology ? "geology-only" : "sparse";
    zone.documents.sort((a, b) => a.title.localeCompare(b.title, "vi"));
  }

  return [...zones.values()].sort((a, b) => b.documentCount - a.documentCount);
}

export function buildProvinces(documents, zones = buildZones(documents)) {
  const provinces = new Map();

  const ensure = (slug) => {
    if (!provinces.has(slug)) {
      const meta = PROVINCE_BY_SLUG.get(slug);
      provinces.set(slug, {
        slug,
        name: meta?.name ?? slug,
        region: meta?.region ?? null,
        mergedInto: meta?.mergedInto ?? null,
        documentCount: 0,
        hostedCount: 0,
        sizeBytes: 0,
        zones: [],
        categories: {},
        kinds: {},
        collections: {},
        lastModified: null
      });
    }
    return provinces.get(slug);
  };

  for (const doc of documents) {
    if (!doc.provinceSlug) continue;
    const province = ensure(doc.provinceSlug);
    province.documentCount += 1;
    if (isHosted(doc)) province.hostedCount += 1;
    province.sizeBytes += doc.sizeBytes ?? 0;
    increment(province.categories, doc.category);
    increment(province.kinds, doc.kind);
    increment(province.collections, doc.collection);
    if (doc.modifiedAt && (!province.lastModified || doc.modifiedAt > province.lastModified)) {
      province.lastModified = doc.modifiedAt;
    }
  }

  for (const zone of zones) {
    if (!zone.provinceSlug) continue;
    ensure(zone.provinceSlug).zones.push(zone);
  }

  for (const province of provinces.values()) {
    province.zoneCount = province.zones.length;
    province.completeZones = province.zones.filter((zone) => zone.coverage === "complete").length;
    province.zones.sort((a, b) => b.documentCount - a.documentCount);
    // 0-100 readiness: has zone maps, has geology, has standards/design context, breadth of zones.
    const hasMaps = province.zones.some((zone) => zone.hasMap);
    const hasGeology = province.zones.some((zone) => zone.hasGeology);
    province.readiness = Math.min(
      100,
      (hasMaps ? 30 : 0) +
        (hasGeology ? 35 : 0) +
        Math.min(20, province.zoneCount * 4) +
        Math.min(15, Math.round((province.hostedCount / Math.max(1, province.documentCount)) * 15))
    );
  }

  return [...provinces.values()].sort((a, b) => b.documentCount - a.documentCount);
}

export function buildRegions(documents, provinces = buildProvinces(documents)) {
  return REGIONS.map((region) => {
    const regionProvinces = provinces.filter((province) => province.region === region.id);
    const regionDocuments = documents.filter((doc) => doc.region === region.id);
    const categories = {};
    const kinds = {};
    for (const doc of regionDocuments) {
      increment(categories, doc.category);
      increment(kinds, doc.kind);
    }
    return {
      ...region,
      provinceCount: regionProvinces.length,
      zoneCount: regionProvinces.reduce((sum, province) => sum + province.zoneCount, 0),
      documentCount: regionDocuments.length,
      hostedCount: regionDocuments.filter(isHosted).length,
      sizeBytes: regionDocuments.reduce((sum, doc) => sum + (doc.sizeBytes ?? 0), 0),
      completeZones: regionProvinces.reduce((sum, province) => sum + province.completeZones, 0),
      readiness: regionProvinces.length
        ? Math.round(regionProvinces.reduce((sum, province) => sum + province.readiness, 0) / regionProvinces.length)
        : 0,
      categories,
      kinds,
      provinces: regionProvinces
    };
  });
}

export function buildStats(documents) {
  const zones = buildZones(documents);
  const provinces = buildProvinces(documents, zones);
  const regions = buildRegions(documents, provinces);

  const byCategory = {};
  const byKind = {};
  const byCollection = {};
  const byLanguage = {};
  const byYear = {};
  for (const doc of documents) {
    increment(byCategory, doc.category);
    increment(byKind, doc.kind);
    increment(byCollection, doc.collection);
    increment(byLanguage, doc.language);
    if (doc.modifiedAt) increment(byYear, doc.modifiedAt.slice(0, 4));
  }

  const hosted = documents.filter(isHosted);
  const shareOnly = documents.filter((doc) => !doc.uploadable);

  return {
    totals: {
      documents: documents.length,
      hosted: hosted.length,
      shareOnly: shareOnly.length,
      sizeBytes: documents.reduce((sum, doc) => sum + (doc.sizeBytes ?? 0), 0),
      hostedBytes: hosted.reduce((sum, doc) => sum + (doc.sizeBytes ?? 0), 0),
      provinces: provinces.length,
      zones: zones.length,
      completeZones: zones.filter((zone) => zone.coverage === "complete").length,
      unassigned: documents.filter((doc) => !doc.provinceSlug).length
    },
    byCategory,
    byKind,
    byCollection,
    byLanguage,
    byYear,
    regions,
    provinces,
    zones,
    gaps: {
      mapOnly: zones.filter((zone) => zone.coverage === "map-only").map((zone) => zone.key),
      geologyOnly: zones.filter((zone) => zone.coverage === "geology-only").map((zone) => zone.key),
      provincesWithoutGeology: provinces.filter((province) => !province.zones.some((zone) => zone.hasGeology)).map((province) => province.slug)
    }
  };
}

/**
 * Deterministic Vietnamese commentary for the analysis tab. This is what renders when
 * AI_ANALYSIS_ENABLED is false, and what Gemini is asked to expand on when it is true.
 */
export function buildNarrative(stats, language = "vi") {
  const { totals, regions, provinces, byCategory, gaps } = stats;
  const topRegion = [...regions].sort((a, b) => b.documentCount - a.documentCount)[0];
  const topProvinces = provinces.slice(0, 3);
  const categoryLeaders = sortedEntries(byCategory, 3).map(([id, count]) => {
    const category = CATEGORIES.find((item) => item.id === id);
    return `${category?.label[language] ?? category?.label.vi ?? id} (${count})`;
  });

  if (language === "en") {
    return [
      `${totals.documents} records across ${totals.provinces} provinces and ${totals.zones} industrial parks.`,
      `${totals.completeZones} park(s) have both a site layout and a geotechnical record.`,
      topRegion ? `${topRegion.name.en} is the deepest region: ${topRegion.documentCount} records over ${topRegion.provinceCount} provinces and ${topRegion.zoneCount} parks.` : "",
      topProvinces.length ? `Best-covered provinces: ${topProvinces.map((province) => `${province.name} (${province.documentCount})`).join(", ")}.` : "",
      categoryLeaders.length ? `Record mix: ${categoryLeaders.join(", ")}.` : "",
      gaps.geologyOnly.length || gaps.mapOnly.length
        ? `Gaps: ${gaps.geologyOnly.length} park(s) have geology but no layout, ${gaps.mapOnly.length} have a layout but no geotechnical record yet.`
        : ""
    ].filter(Boolean);
  }

  return [
    `${totals.documents} hồ sơ trên ${totals.provinces} tỉnh/thành và ${totals.zones} khu công nghiệp.`,
    `${totals.completeZones} KCN có đủ cả sơ đồ mặt bằng và hồ sơ khảo sát địa chất.`,
    topRegion ? `${topRegion.name.vi} là vùng có dữ liệu dày nhất: ${topRegion.documentCount} hồ sơ trên ${topRegion.provinceCount} tỉnh và ${topRegion.zoneCount} KCN.` : "",
    topProvinces.length ? `Tỉnh được phủ tốt nhất: ${topProvinces.map((province) => `${province.name} (${province.documentCount})`).join(", ")}.` : "",
    categoryLeaders.length ? `Cấu trúc hồ sơ: ${categoryLeaders.join(", ")}.` : "",
    gaps.geologyOnly.length || gaps.mapOnly.length
      ? `Khoảng trống: ${gaps.geologyOnly.length} KCN có hồ sơ địa chất nhưng chưa có sơ đồ, ${gaps.mapOnly.length} KCN có sơ đồ nhưng chưa có hồ sơ địa chất.`
      : ""
  ].filter(Boolean);
}

export function filterDocuments(documents, filters = {}) {
  const { region, province, zone, category, collection, kind, language, query, hostedOnly } = filters;
  const needle = query ? String(query).toLowerCase() : null;

  return documents.filter((doc) => {
    if (region && doc.region !== region) return false;
    if (province && doc.provinceSlug !== province) return false;
    if (zone && doc.zoneSlug !== zone) return false;
    if (category && doc.category !== category) return false;
    if (collection && doc.collection !== collection) return false;
    if (kind && doc.kind !== kind) return false;
    if (language && doc.language !== language) return false;
    if (hostedOnly && !isHosted(doc)) return false;
    if (needle) {
      const haystack = `${doc.title} ${doc.fileName} ${doc.relPath} ${doc.zoneName ?? ""} ${doc.provinceName ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
