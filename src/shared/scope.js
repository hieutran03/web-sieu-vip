// What belongs on this site: geotechnical surveys and layouts of industrial parks, placed on the
// map. A record needs a known province and a zone; other material (TNF/TCCS packages, cement
// studies, nationwide atlases) is out of scope even if it is still stored in Cloudinary from an
// earlier upload — which is why the filter is applied to live listings, not just to the snapshot.

export const SITE_COLLECTIONS = new Set(["industrial-zones", "zone-geology"]);

export function inSiteScope(doc) {
  return SITE_COLLECTIONS.has(doc.collection) && Boolean(doc.provinceSlug) && Boolean(doc.zoneSlug);
}

export function filterToSiteScope(documents) {
  return documents.filter(inSiteScope);
}
