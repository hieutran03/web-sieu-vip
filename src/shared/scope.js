import { normalizeKey } from "./text.js";

// Only the requested southern geology source tree is part of the public library.
export function inSiteScope(doc) {
  const segments = String(doc.relPath ?? "").replace(/\\/g, "/").split("/");
  return normalizeKey(segments[0]) === "n1 dia chat viet nam" &&
    normalizeKey(segments[1]) === "r1 2 dia chat kcn mien nam" &&
    !doc.archived && !segments.some((segment) => normalizeKey(segment) === "old");
}

export function filterToSiteScope(documents) {
  return documents.filter(inSiteScope);
}
