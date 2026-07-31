// Pure text helpers shared by the app, the build scripts, the API functions and the MCP server.

const DIACRITIC_MAP = {
  a: "àáạảãâầấậẩẫăằắặẳẵ",
  e: "èéẹẻẽêềếệểễ",
  i: "ìíịỉĩ",
  o: "òóọỏõôồốộổỗơờớợởỡ",
  u: "ùúụủũưừứựửữ",
  y: "ỳýỵỷỹ",
  d: "đ"
};

const CHAR_TO_ASCII = new Map();
for (const [ascii, group] of Object.entries(DIACRITIC_MAP)) {
  for (const char of group) {
    CHAR_TO_ASCII.set(char, ascii);
    CHAR_TO_ASCII.set(char.toUpperCase(), ascii.toUpperCase());
  }
}

/** Strip Vietnamese diacritics without relying on Intl/Unicode tables. */
export function deaccent(value) {
  return String(value ?? "")
    .split("")
    .map((char) => CHAR_TO_ASCII.get(char) ?? char)
    .join("");
}

/** Lowercase, unaccented, punctuation-free form used for fuzzy matching. */
export function normalizeKey(value) {
  return deaccent(value)
    .toLowerCase()
    .replace(/[_\-.,;:()[\]{}'"`~!?*+/\\|<>@#$%^&=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** URL/id friendly slug: `Bà Rịa - Vũng Tàu` -> `ba-ria-vung-tau`. */
export function slugify(value) {
  return normalizeKey(value).replace(/\s+/g, "-");
}

/** Cloudinary public_id safe segment (keeps case-insensitive uniqueness readable). */
export function publicIdSegment(value) {
  return deaccent(value)
    .replace(/[^a-zA-Z0-9._\- ]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function titleCase(value) {
  return String(value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
