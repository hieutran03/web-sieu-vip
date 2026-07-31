// Server-side view of the document catalog: the committed snapshot (built by scripts/buildCatalog.mjs)
// merged with whatever currently lives in Cloudinary (so admin uploads appear without a rebuild).

import { createRequire } from "node:module";
import { inSiteScope } from "../src/shared/scope.js";
import { listResources, searchResources } from "./cloudinary.mjs";
import { documentFromResource } from "./documentKeys.mjs";

const require = createRequire(import.meta.url);
// require() keeps the JSON traceable for the Vercel bundler.
const snapshot = require("../src/data/documentCatalog.json");

const CACHE_TTL_MS = 60 * 1000;
let cache = { at: 0, documents: null };

export function catalogSnapshot() {
  return snapshot;
}

/** Every document Cloudinary knows about, newest first. */
export async function liveDocuments({ force = false } = {}) {
  if (!force && cache.documents && Date.now() - cache.at < CACHE_TTL_MS) return cache.documents;

  const folder = process.env.CLOUDINARY_ROOT_FOLDER || "v-tnf";
  const documents = [];

  try {
    let cursor;
    do {
      const page = await searchResources({
        expression: `folder=${folder}/*`,
        maxResults: 500,
        nextCursor: cursor
      });
      documents.push(...(page.resources ?? []).map(documentFromResource));
      cursor = page.next_cursor;
    } while (cursor && documents.length < 5000);
  } catch (searchError) {
    // The Search API needs a plan that includes it; fall back to per-type listings.
    for (const resourceType of ["image", "raw", "video"]) {
      let cursor;
      do {
        const page = await listResources({ prefix: `${folder}/`, resourceType, nextCursor: cursor });
        documents.push(...(page.resources ?? []).map(documentFromResource));
        cursor = page.next_cursor;
      } while (cursor && documents.length < 5000);
    }
    if (!documents.length) throw searchError;
  }

  cache = { at: Date.now(), documents };
  return documents;
}

/**
 * Snapshot + live merge. The snapshot stays authoritative for titles and classification of
 * documents it knows (it is rebuilt from the share); the live record contributes the delivery
 * URL, plus any document that only exists in Cloudinary (admin uploads). Snapshot rows that are
 * not hosted survive so the UI can still show share-only documents.
 */
export async function mergedDocuments({ includeLive = true, force = false } = {}) {
  const byId = new Map(snapshot.documents.map((doc) => [doc.id, doc]));

  if (includeLive) {
    try {
      for (const live of await liveDocuments({ force })) {
        const existing = byId.get(live.id);
        if (existing) byId.set(live.id, { ...existing, cloudinary: live.cloudinary });
        else if (inSiteScope(live)) byId.set(live.id, live);
      }
    } catch (error) {
      return { documents: [...byId.values()], liveError: String(error.message ?? error) };
    }
  }

  return { documents: [...byId.values()], liveError: null };
}
