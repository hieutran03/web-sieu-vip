// Deterministic, explainable document classification driven by the folder layout on the
// company share. No model call is involved: every field comes from a rule that can be
// pointed at, which is what makes the catalog reproducible (and lets Gemini/MCP audit it later).

import { findProvince, findRegionByFolder, PROVINCE_BY_SLUG, REGIONS } from "./provinceMeta.js";
import { deaccent, normalizeKey, slugify } from "./text.js";

export const IGNORED_FILES = new Set(["thumbs.db", ".ds_store", "desktop.ini", "$recycle.bin"]);
export const IGNORED_EXTENSIONS = new Set(["db", "ini", "tmp", "lnk", "bak", "log"]);

export const MEDIA_KINDS = {
  image: { id: "image", label: { vi: "Hình ảnh / sơ đồ", en: "Image / diagram", ja: "画像・図" }, extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"] },
  pdf: { id: "pdf", label: { vi: "PDF", en: "PDF", ja: "PDF" }, extensions: ["pdf"] },
  document: { id: "document", label: { vi: "Văn bản", en: "Document", ja: "文書" }, extensions: ["doc", "docx", "rtf", "txt", "odt"] },
  spreadsheet: { id: "spreadsheet", label: { vi: "Bảng tính", en: "Spreadsheet", ja: "表計算" }, extensions: ["xls", "xlsx", "xlsm", "csv"] },
  presentation: { id: "presentation", label: { vi: "Trình chiếu", en: "Presentation", ja: "スライド" }, extensions: ["ppt", "pptx"] },
  drawing: { id: "drawing", label: { vi: "Bản vẽ CAD", en: "CAD drawing", ja: "CAD図面" }, extensions: ["dwg", "dxf", "dwf"] },
  video: { id: "video", label: { vi: "Video", en: "Video", ja: "動画" }, extensions: ["mp4", "mov", "avi", "mkv", "wmv"] },
  archive: { id: "archive", label: { vi: "Tệp nén", en: "Archive", ja: "圧縮ファイル" }, extensions: ["zip", "rar", "7z", "tar", "gz"] },
  link: { id: "link", label: { vi: "Liên kết", en: "Link", ja: "リンク" }, extensions: ["url", "webloc"] },
  other: { id: "other", label: { vi: "Khác", en: "Other", ja: "その他" }, extensions: [] }
};

const EXTENSION_TO_KIND = new Map();
for (const kind of Object.values(MEDIA_KINDS)) {
  for (const extension of kind.extensions) EXTENSION_TO_KIND.set(extension, kind.id);
}

// Semantic buckets. Order matters: the first matching rule wins.
export const CATEGORIES = [
  { id: "zone-map", label: { vi: "Sơ đồ / mặt bằng KCN", en: "Industrial zone map", ja: "工業団地図" }, color: "oklch(50% 0.12 235)" },
  { id: "zone-profile", label: { vi: "Hồ sơ khu công nghiệp", en: "Industrial zone profile", ja: "工業団地資料" }, color: "oklch(58% 0.13 168)" },
  { id: "geology", label: { vi: "Khảo sát địa chất", en: "Geotechnical survey", ja: "地盤調査" }, color: "oklch(52% 0.11 76)" },
  { id: "standard", label: { vi: "Tiêu chuẩn TCVN / TCCS", en: "TCVN / TCCS standard", ja: "規格 (TCVN/TCCS)" }, color: "oklch(52% 0.16 286)" },
  { id: "design", label: { vi: "Thiết kế TNF", en: "TNF design", ja: "TNF設計" }, color: "oklch(45% 0.13 164)" },
  { id: "construction", label: { vi: "Thi công", en: "Construction", ja: "施工" }, color: "oklch(57% 0.16 38)" },
  { id: "testing", label: { vi: "Thí nghiệm & quản lý chất lượng", en: "Testing & QC", ja: "試験・品質管理" }, color: "oklch(60% 0.14 200)" },
  { id: "materials", label: { vi: "Vật liệu & xi măng", en: "Materials & cement", ja: "材料・セメント" }, color: "oklch(63% 0.13 120)" },
  { id: "fem", label: { vi: "Phân tích FEM", en: "FEM analysis", ja: "FEM解析" }, color: "oklch(55% 0.15 300)" },
  { id: "layout", label: { vi: "Bố trí V-TNF", en: "V-TNF layout", ja: "V-TNF配置" }, color: "oklch(56% 0.12 140)" },
  { id: "report", label: { vi: "Báo cáo & thuyết minh", en: "Reports & memos", ja: "報告書・説明書" }, color: "oklch(48% 0.09 176)" },
  { id: "dissemination", label: { vi: "Phổ biến & đào tạo", en: "Dissemination & training", ja: "普及・研修" }, color: "oklch(66% 0.14 76)" },
  { id: "other", label: { vi: "Tài liệu khác", en: "Other documents", ja: "その他資料" }, color: "oklch(60% 0.02 176)" }
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

// Top-level programs on the share, matched against the first two path segments.
// Order matters: the more specific folder wins (`R1.6 Địa chất KCN` before `N1-Địa chất Việt Nam`).
export const COLLECTIONS = [
  {
    id: "industrial-zones",
    match: ["r1 1 khu cong nghiep", "khu cong nghiep"],
    label: { vi: "Khu công nghiệp", en: "Industrial zones", ja: "工業団地" }
  },
  {
    id: "zone-geology",
    match: ["dia chat kcn", "dia chat  kcn"],
    label: { vi: "Địa chất khu công nghiệp", en: "Industrial zone geology", ja: "工業団地の地盤" }
  },
  {
    id: "materials",
    match: ["khao sat xi mang", "xi mang"],
    label: { vi: "Khảo sát xi măng & vật liệu", en: "Cement & materials survey", ja: "セメント・材料調査" }
  },
  {
    id: "geology",
    match: ["ho so dia chat", "dia chat viet nam"],
    label: { vi: "Hồ sơ địa chất công trình", en: "Project geotechnical records", ja: "工事地盤資料" }
  },
  {
    id: "tnf-technical",
    match: ["tnf工法技術資料", "第1", "phase 1"],
    label: { vi: "Tài liệu kỹ thuật TNF", en: "TNF technical package", ja: "TNF工法技術資料" }
  },
  { id: "tccs", match: ["tccs"], label: { vi: "Cập nhật TCCS 88", en: "TCCS 88 update", ja: "TCCS改定" } },
  { id: "layout", match: ["hinh thuc bo tri", "n2"], label: { vi: "Bố trí V-TNF", en: "V-TNF layout", ja: "V-TNF配置" } },
  { id: "fem", match: ["phan tich fem", "n3"], label: { vi: "Phân tích FEM", en: "FEM analysis", ja: "FEM解析" } },
  {
    id: "experiments",
    match: ["thi nghiem", "thuc nghiem kiem chung"],
    label: { vi: "Thí nghiệm & kiểm chứng", en: "Experiments & validation", ja: "実験・検証" }
  },
  {
    id: "dissemination",
    match: ["tong hop pho bien"],
    label: { vi: "Tổng hợp & phổ biến", en: "Summary & dissemination", ja: "総括・普及" }
  },
  { id: "misc", match: [], label: { vi: "Tài liệu khác", en: "Other material", ja: "その他" } }
];

export const COLLECTION_BY_ID = new Map(COLLECTIONS.map((collection) => [collection.id, collection]));

export function extensionOf(fileName) {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

export function mediaKindOf(fileName) {
  return EXTENSION_TO_KIND.get(extensionOf(fileName)) ?? "other";
}

export function shouldIgnore(fileName) {
  const lower = fileName.toLowerCase();
  return IGNORED_FILES.has(lower) || IGNORED_EXTENSIONS.has(extensionOf(fileName));
}

export function detectLanguage(value) {
  if (/[぀-ヿ一-龯]/.test(value)) return "ja";
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(value)) return "vi";
  return "en";
}

function detectCollection(segments) {
  // Only the program folders (first two levels) decide the collection, so a file that merely
  // mentions "xi măng" deep inside the TCCS tree is not pulled into the materials collection.
  const haystack = normalizeKey(segments.slice(0, 2).join(" / "));
  for (const collection of COLLECTIONS) {
    if (collection.match.some((fragment) => haystack.includes(fragment))) return collection.id;
  }
  return "misc";
}

function detectCategory({ segments, fileName, kind, collection }) {
  const haystack = normalizeKey([...segments, fileName].join(" / "));
  const has = (...fragments) => fragments.some((fragment) => haystack.includes(fragment));

  if (collection === "industrial-zones") {
    return kind === "image" || kind === "pdf" ? "zone-map" : "zone-profile";
  }
  if (collection === "zone-geology" || collection === "geology") return "geology";
  if (collection === "materials") return has("tcvn", "tccs", "tieu chuan") ? "standard" : "materials";
  if (has("khao sat dia chat", "ho so dia chat", "tru ho khoan", "borehole", "geological", "ksdc", "bcdc", "bc dia chat", "bckh dia chat", "soil investigation", "地盤調査")) {
    return "geology";
  }
  if (has("xi mang", "cement", "slag", "スラグ")) {
    return has("tcvn") ? "standard" : "materials";
  }
  if (has("tcvn", "tccs", "eurocode", "en 1996", "tieu chuan", "規格")) return "standard";
  if (has("thiet ke", "設計", "design manual", "design")) return "design";
  if (has("thi cong", "施工", "construction process")) return "construction";
  if (has("thi nghiem", "試験", "品質管理", "quality", "nen mau", "uu", "kiem chung")) return "testing";
  if (has("fem")) return "fem";
  if (has("bo tri", "配置", "layout")) return "layout";
  if (has("pho bien", "普及", "training", "dao tao")) return "dissemination";
  if (has("bao cao", "報告", "thuyet minh", "説明", "memo", "cong van", "tra loi")) return "report";
  if (kind === "video") return "testing";
  return "other";
}

/**
 * Classify one file from its path relative to the documentation root.
 * @param {string[]} segments folder segments (no file name)
 * @param {string} fileName
 */
export function classifyDocument(segments, fileName) {
  const kind = mediaKindOf(fileName);
  const collection = detectCollection([...segments, fileName]);
  const category = detectCategory({ segments, fileName, kind, collection });

  let region = null;
  let province = null;
  let zone = null;
  let archived = false;
  const reasons = [];

  for (const segment of segments) {
    const regionFromFolder = findRegionByFolder(segment);
    if (regionFromFolder && !region) {
      region = regionFromFolder;
      reasons.push(`region từ thư mục "${segment}"`);
    }
    if (normalizeKey(segment) === "old") {
      archived = true;
      reasons.push("nằm trong thư mục OLD");
    }
  }

  // Province: the folder right under a `KCN miền …` node is a province in the zone tree;
  // elsewhere the province name is embedded in a project folder title.
  for (const segment of segments) {
    const hit = findProvince(segment);
    if (hit) {
      province = hit;
      reasons.push(`tỉnh từ thư mục "${segment}"`);
      break;
    }
  }
  if (!province) {
    const hit = findProvince(fileName);
    if (hit) {
      province = hit;
      reasons.push(`tỉnh từ tên tệp "${fileName}"`);
    }
  }
  if (province && !region) {
    region = province.region;
    reasons.push(`region suy ra từ tỉnh ${province.name}`);
  }

  // Both `R1.1 Khu công nghiệp` and `R1.x Địa chất KCN miền …` are Region → Province → Zone trees.
  // Outside those trees (e.g. a file dropped in by an admin) a `KCN <name>` prefix still counts.
  if (!ZONE_TREE_COLLECTIONS.has(collection)) {
    const fromName = zoneFromFileName(fileName);
    if (fromName) {
      zone = fromName;
      reasons.push(`KCN suy ra từ tên tệp "${fileName}"`);
    }
  } else {
    const provinceIndex = province ? segments.findIndex((segment) => findProvince(segment)?.id === province.id) : -1;
    const afterProvince = provinceIndex >= 0 ? segments.slice(provinceIndex + 1).filter((segment) => normalizeKey(segment) !== "old") : [];
    if (afterProvince.length) {
      zone = afterProvince[0];
      reasons.push(`KCN từ thư mục "${zone}"`);
    } else {
      const fromName = zoneFromFileName(fileName);
      if (fromName) {
        zone = fromName;
        reasons.push(`KCN suy ra từ tên tệp "${fileName}"`);
      } else if (province) {
        zone = fileName.replace(/\.[A-Za-z0-9]+$/, "");
        reasons.push("KCN suy ra từ tên tệp (tệp nằm trực tiếp trong thư mục tỉnh)");
      }
    }
  }

  const zoneName = zone ? cleanZoneName(zone) : null;

  return {
    collection,
    category,
    kind,
    extension: extensionOf(fileName),
    region: region ?? null,
    provinceSlug: province?.slug ?? null,
    provinceName: province?.name ?? null,
    zoneName,
    zoneSlug: zoneName ? slugify(zoneName) : null,
    archived,
    language: detectLanguage(fileName),
    classifiedBy: "rules",
    reasons
  };
}

export const ZONE_TREE_COLLECTIONS = new Set(["industrial-zones", "zone-geology"]);

/**
 * Pull the zone name out of a file name such as
 * `KCN Gia Lễ, huyện Đông Hưng, tỉnh Thái Bình.rar` -> `Gia Lễ`.
 * deaccent() is char-for-char, so match offsets stay valid on the original string.
 */
export function zoneFromFileName(fileName) {
  const base = fileName.replace(/\.[A-Za-z0-9]+$/, "");
  const probe = deaccent(base).toLowerCase();
  const match = /(?:^|[\s_\-.(])(kcn|ccn|khu cong nghiep|khu cn)[\s._-]+/.exec(probe);
  if (!match) return null;
  const candidate = base
    .slice(match.index + match[0].length)
    .split(/[,(\[]|\s+-\s+/)[0]
    .trim();
  return candidate.length >= 2 ? candidate : null;
}

// Names that must stay upper-case when an ALL-CAPS folder name is title-cased.
const ACRONYMS = new Set(["VSIP", "DEEP", "C", "KCN", "CCN", "VN", "JV", "TNF", "AMATA", "IP", "II", "III", "IV", "A", "B", "D", "E"]);

/** `KCN VSIP BAC NINH` / `KCN QUE VO 1` -> `VSIP Bac Ninh` / `Que Vo 1`. */
export function cleanZoneName(value) {
  const stripped = String(value)
    .replace(/\.[A-Za-z0-9]+$/, "")
    .replace(/^\s*(kcn|khu cong nghiep|khu công nghiệp|ip)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return String(value).trim();
  const allCaps = stripped === stripped.toUpperCase();
  if (!allCaps) return stripped;
  return stripped
    .split(" ")
    .map((word) => {
      if (ACRONYMS.has(word.toUpperCase()) || /\d/.test(word)) return word.toUpperCase();
      const lower = word.toLowerCase();
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function categoryLabel(categoryId, language = "vi") {
  const category = CATEGORY_BY_ID.get(categoryId) ?? CATEGORY_BY_ID.get("other");
  return category.label[language] ?? category.label.vi;
}

export function collectionLabel(collectionId, language = "vi") {
  const collection = COLLECTION_BY_ID.get(collectionId) ?? COLLECTION_BY_ID.get("misc");
  return collection.label[language] ?? collection.label.vi;
}

export function kindLabel(kindId, language = "vi") {
  const kind = MEDIA_KINDS[kindId] ?? MEDIA_KINDS.other;
  return kind.label[language] ?? kind.label.vi;
}

export function regionLabel(regionId, language = "vi") {
  const region = REGIONS.find((item) => item.id === regionId);
  return region ? region.name[language] ?? region.name.vi : language === "vi" ? "Chưa xác định" : "Unassigned";
}

export function provinceLabel(provinceSlug) {
  return PROVINCE_BY_SLUG.get(provinceSlug)?.name ?? null;
}
