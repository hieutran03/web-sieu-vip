// The 63 pre-2025 provinces (the administrative units the document folders were named after),
// each mapped to a macro region and to the post-01/07/2025 merged unit.
//
// `id` is the GSO level1 code, which is also the file name used by the dvhcvn GIS dataset,
// so the geometry build script and this table stay in sync.
// `aliases` cover the spellings that actually appear in folder and file names on the share.

import { normalizeKey, slugify } from "./text.js";

export const REGIONS = [
  {
    id: "north",
    folder: "KCN miền Bắc",
    name: { vi: "Miền Bắc", en: "Northern Vietnam", ja: "北部" },
    color: "oklch(50% 0.12 235)"
  },
  {
    id: "central",
    folder: "KCN miền Trung",
    name: { vi: "Miền Trung", en: "Central Vietnam", ja: "中部" },
    color: "oklch(66% 0.14 76)"
  },
  {
    id: "south",
    folder: "KCN miền Nam",
    name: { vi: "Miền Nam", en: "Southern Vietnam", ja: "南部" },
    color: "oklch(45% 0.13 164)"
  }
];

export const PROVINCES = [
  { id: "01", name: "Hà Nội", region: "north", mergedInto: "Hà Nội", aliases: ["ha noi", "hanoi", "tp ha noi"] },
  { id: "02", name: "Hà Giang", region: "north", mergedInto: "Tuyên Quang" },
  { id: "04", name: "Cao Bằng", region: "north", mergedInto: "Cao Bằng" },
  { id: "06", name: "Bắc Kạn", region: "north", mergedInto: "Thái Nguyên", aliases: ["bac can"] },
  { id: "08", name: "Tuyên Quang", region: "north", mergedInto: "Tuyên Quang" },
  { id: "10", name: "Lào Cai", region: "north", mergedInto: "Lào Cai" },
  { id: "11", name: "Điện Biên", region: "north", mergedInto: "Điện Biên" },
  { id: "12", name: "Lai Châu", region: "north", mergedInto: "Lai Châu" },
  { id: "14", name: "Sơn La", region: "north", mergedInto: "Sơn La" },
  { id: "15", name: "Yên Bái", region: "north", mergedInto: "Lào Cai" },
  { id: "17", name: "Hòa Bình", region: "north", mergedInto: "Phú Thọ", aliases: ["hoa binh"] },
  { id: "19", name: "Thái Nguyên", region: "north", mergedInto: "Thái Nguyên" },
  { id: "20", name: "Lạng Sơn", region: "north", mergedInto: "Lạng Sơn" },
  { id: "22", name: "Quảng Ninh", region: "north", mergedInto: "Quảng Ninh" },
  { id: "24", name: "Bắc Giang", region: "north", mergedInto: "Bắc Ninh" },
  { id: "25", name: "Phú Thọ", region: "north", mergedInto: "Phú Thọ" },
  { id: "26", name: "Vĩnh Phúc", region: "north", mergedInto: "Phú Thọ" },
  { id: "27", name: "Bắc Ninh", region: "north", mergedInto: "Bắc Ninh" },
  { id: "30", name: "Hải Dương", region: "north", mergedInto: "Hải Phòng" },
  { id: "31", name: "Hải Phòng", region: "north", mergedInto: "Hải Phòng", aliases: ["hai phong", "tp hai phong"] },
  { id: "33", name: "Hưng Yên", region: "north", mergedInto: "Hưng Yên" },
  { id: "34", name: "Thái Bình", region: "north", mergedInto: "Hưng Yên" },
  { id: "35", name: "Hà Nam", region: "north", mergedInto: "Ninh Bình" },
  { id: "36", name: "Nam Định", region: "north", mergedInto: "Ninh Bình" },
  { id: "37", name: "Ninh Bình", region: "north", mergedInto: "Ninh Bình" },
  { id: "38", name: "Thanh Hóa", region: "central", mergedInto: "Thanh Hóa" },
  { id: "40", name: "Nghệ An", region: "central", mergedInto: "Nghệ An" },
  { id: "42", name: "Hà Tĩnh", region: "central", mergedInto: "Hà Tĩnh" },
  { id: "44", name: "Quảng Bình", region: "central", mergedInto: "Quảng Trị" },
  { id: "45", name: "Quảng Trị", region: "central", mergedInto: "Quảng Trị" },
  {
    id: "46",
    name: "Thừa Thiên Huế",
    region: "central",
    mergedInto: "Huế",
    aliases: ["hue", "thua thien hue", "tp hue", "thanh pho hue"]
  },
  { id: "48", name: "Đà Nẵng", region: "central", mergedInto: "Đà Nẵng", aliases: ["da nang", "tp da nang"] },
  { id: "49", name: "Quảng Nam", region: "central", mergedInto: "Đà Nẵng" },
  { id: "51", name: "Quảng Ngãi", region: "central", mergedInto: "Quảng Ngãi" },
  { id: "52", name: "Bình Định", region: "central", mergedInto: "Gia Lai" },
  { id: "54", name: "Phú Yên", region: "central", mergedInto: "Đắk Lắk" },
  { id: "56", name: "Khánh Hòa", region: "central", mergedInto: "Khánh Hòa" },
  { id: "58", name: "Ninh Thuận", region: "central", mergedInto: "Khánh Hòa" },
  { id: "60", name: "Bình Thuận", region: "central", mergedInto: "Lâm Đồng" },
  { id: "62", name: "Kon Tum", region: "central", mergedInto: "Quảng Ngãi" },
  { id: "64", name: "Gia Lai", region: "central", mergedInto: "Gia Lai" },
  { id: "66", name: "Đắk Lắk", region: "central", mergedInto: "Đắk Lắk", aliases: ["dak lak", "daklak"] },
  { id: "67", name: "Đắk Nông", region: "central", mergedInto: "Lâm Đồng", aliases: ["dak nong", "dak nong"] },
  { id: "68", name: "Lâm Đồng", region: "central", mergedInto: "Lâm Đồng" },
  { id: "70", name: "Bình Phước", region: "south", mergedInto: "Đồng Nai" },
  { id: "72", name: "Tây Ninh", region: "south", mergedInto: "Tây Ninh" },
  { id: "74", name: "Bình Dương", region: "south", mergedInto: "TP. Hồ Chí Minh" },
  { id: "75", name: "Đồng Nai", region: "south", mergedInto: "Đồng Nai" },
  {
    id: "77",
    name: "Bà Rịa - Vũng Tàu",
    region: "south",
    mergedInto: "TP. Hồ Chí Minh",
    aliases: ["ba ria vung tau", "ba ria - vung tau", "brvt", "vung tau"]
  },
  {
    id: "79",
    name: "TP. Hồ Chí Minh",
    region: "south",
    mergedInto: "TP. Hồ Chí Minh",
    aliases: ["ho chi minh", "hcm", "tp hcm", "tphcm", "sai gon", "saigon", "thanh pho ho chi minh"]
  },
  { id: "80", name: "Long An", region: "south", mergedInto: "Tây Ninh" },
  { id: "82", name: "Tiền Giang", region: "south", mergedInto: "Đồng Tháp" },
  { id: "83", name: "Bến Tre", region: "south", mergedInto: "Vĩnh Long" },
  { id: "84", name: "Trà Vinh", region: "south", mergedInto: "Vĩnh Long" },
  { id: "86", name: "Vĩnh Long", region: "south", mergedInto: "Vĩnh Long" },
  { id: "87", name: "Đồng Tháp", region: "south", mergedInto: "Đồng Tháp" },
  { id: "89", name: "An Giang", region: "south", mergedInto: "An Giang" },
  { id: "91", name: "Kiên Giang", region: "south", mergedInto: "An Giang" },
  { id: "92", name: "Cần Thơ", region: "south", mergedInto: "Cần Thơ", aliases: ["can tho", "tp can tho"] },
  { id: "93", name: "Hậu Giang", region: "south", mergedInto: "Cần Thơ" },
  { id: "94", name: "Sóc Trăng", region: "south", mergedInto: "Cần Thơ" },
  { id: "95", name: "Bạc Liêu", region: "south", mergedInto: "Cà Mau" },
  { id: "96", name: "Cà Mau", region: "south", mergedInto: "Cà Mau" }
].map((province) => ({ ...province, slug: slugify(province.name) }));

export const PROVINCE_BY_ID = new Map(PROVINCES.map((province) => [province.id, province]));
export const PROVINCE_BY_SLUG = new Map(PROVINCES.map((province) => [province.slug, province]));
export const REGION_BY_ID = new Map(REGIONS.map((region) => [region.id, region]));

// Province names whose unaccented form collides with a district/commune name, so a bare
// mention is not enough: `THẠNH HÓA` (a district of Long An) deaccents to `thanh hoa`,
// `xã Hòa Bình` exists in several Mekong provinces. These need a `tỉnh`/`TP` marker.
const MARKER_REQUIRED = new Set(["thanh hoa", "hoa binh", "binh minh", "tan an", "hong ngu"]);

// Longest-first lookup table so `Bà Rịa - Vũng Tàu` wins over `Vũng Tàu`.
const PROVINCE_LOOKUP = PROVINCES.flatMap((province) => {
  const keys = new Set([normalizeKey(province.name), ...(province.aliases ?? []).map(normalizeKey)]);
  return [...keys].map((key) => ({ key, province, requiresMarker: MARKER_REQUIRED.has(key) }));
}).sort((a, b) => b.key.length - a.key.length);

const MARKERS = ["tinh", "tp", "thanh pho", "province", "city"];

function hasMarkedMention(haystack, key) {
  return MARKERS.some((marker) => haystack.includes(` ${marker} ${key} `));
}

/**
 * Resolve a folder/file name fragment to a province.
 * Priority: the segment *is* the province name > `tỉnh X` / `TP X` mention > bare mention.
 * Returns null when nothing matches, which is better than guessing a district homonym.
 */
export function findProvince(value) {
  const haystack = normalizeKey(value);
  if (!haystack) return null;
  const padded = ` ${haystack} `;

  const exact = PROVINCE_LOOKUP.find((entry) => entry.key === haystack);
  if (exact) return exact.province;

  const marked = PROVINCE_LOOKUP.find((entry) => hasMarkedMention(padded, entry.key));
  if (marked) return marked.province;

  const bare = PROVINCE_LOOKUP.find((entry) => !entry.requiresMarker && padded.includes(` ${entry.key} `));
  return bare ? bare.province : null;
}

/** All provinces mentioned in a string, primary first (used for multi-province project titles). */
export function findProvinces(value) {
  const haystack = normalizeKey(value);
  if (!haystack) return [];
  const padded = ` ${haystack} `;
  const found = [];
  for (const entry of PROVINCE_LOOKUP) {
    const hit = entry.key === haystack || hasMarkedMention(padded, entry.key) || (!entry.requiresMarker && padded.includes(` ${entry.key} `));
    if (hit && !found.includes(entry.province)) found.push(entry.province);
  }
  return found;
}

/** Resolve the macro region from a folder name such as `KCN miền Bắc`. */
export function findRegionByFolder(value) {
  const key = normalizeKey(value);
  if (!key) return null;
  if (key.includes("mien bac") || key.includes("phia bac")) return "north";
  if (key.includes("mien trung")) return "central";
  if (key.includes("mien nam") || key.includes("phia nam")) return "south";
  return null;
}

export function regionOfProvince(provinceSlug) {
  return PROVINCE_BY_SLUG.get(provinceSlug)?.region ?? null;
}
