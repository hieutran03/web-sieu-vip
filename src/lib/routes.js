const tabs = new Set(["map", "insights"]);

export function readRoute(location) {
  const [legacyPage, legacySearch] = location.hash.replace(/^#\/?/, "").split("?");
  const legacy = tabs.has(legacyPage);
  const path = location.pathname.replace(/^\/+|\/+$/g, "");
  const params = new URLSearchParams(legacy ? legacySearch || "" : location.search);
  return {
    tab: legacy ? legacyPage : tabs.has(path) ? path : "map",
    region: params.get("region"), province: params.get("province"),
    zone: params.get("zone"), district: params.get("district")
  };
}

export function routeUrl({ tab, region, province, zone, district }) {
  const params = new URLSearchParams();
  if (region) params.set("region", region);
  if (province) params.set("province", province);
  if (province && zone) params.set("zone", zone);
  if (province && district) params.set("district", district);
  const query = params.toString();
  return `/${tabs.has(tab) ? tab : "map"}${query ? `?${query}` : ""}`;
}

/** Ignore geographic selections from older links that are absent in the current catalog. */
export function resolveCatalogRoute(route, documents, districts) {
  const region = documents.some((doc) => doc.region === route.region) ? route.region : null;
  const provinceDocs = documents.filter((doc) => doc.provinceSlug && doc.provinceSlug === route.province);
  const province = provinceDocs.length ? route.province : null;
  const zone = province && provinceDocs.some((doc) => doc.zoneSlug === route.zone) ? route.zone : null;
  const district = province && districts.some((point) => point.key === route.district && point.provinceSlug === province && provinceDocs.some((doc) => point.zones.includes(doc.zoneSlug) && doc.projectLocation)) ? route.district : null;
  return { ...route, region: province && region && !provinceDocs.some((doc) => doc.region === region) ? null : region, province, zone: district ? null : zone, district };
}
