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
