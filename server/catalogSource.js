// Server-side view of the document catalog: the committed snapshot (built by scripts/buildCatalog.mjs)
// merged with whatever currently lives in Cloudinary and the self-hosted store (so admin uploads
// appear without a rebuild).

import { createRequire } from "node:module";
import { mergeHosting } from "../src/shared/catalogStats.js";
import { inSiteScope } from "../src/shared/scope.js";
import { listResources, ROOT_FOLDER, searchResources } from "./cloudinary.mjs";
import { documentFromResource } from "./documentKeys.mjs";
import { documentFromStored, listStored, selfStorageConfigured } from "./selfStorage.mjs";

const require = createRequire(import.meta.url);
// require() keeps the JSON traceable for the Vercel bundler.
const snapshot = require("../src/data/documentCatalog.json");

const CACHE_TTL_MS = 60 * 1000;
let cache = { at: 0, documents: null };

export function catalogSnapshot() {
  return { ...snapshot, documents: snapshot.documents.filter(inSiteScope) };
}

/** Every document Cloudinary or the self-hosted store knows about. */
export async function liveDocuments({ force = false } = {}) {
  if (!force && cache.documents && Date.now() - cache.at < CACHE_TTL_MS) return cache.documents;

  const sources = [];
  if (process.env.CLOUDINARY_CLOUD_NAME) sources.push(cloudinaryDocuments());
  if (selfStorageConfigured()) sources.push(listStored({ prefix: `${ROOT_FOLDER()}/` }).then((items) => items.map(documentFromStored)));
  // Deployments can serve the bundled catalog without server-side store credentials.
  if (!sources.length) return [];

  // One store being down (e.g. the home server rebooting) must not hide the other one.
  const results = await Promise.allSettled(sources);
  const documents = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const failure = results.find((result) => result.status === "rejected");
  if (failure && !documents.length) throw failure.reason;

  const snapshotById = new Map(snapshot.documents.filter(inSiteScope).map((doc) => [doc.id, doc]));
  const byId = new Map();
  for (const live of documents) {
    const source = snapshotById.get(live.id);
    if (!source || (Number.isFinite(source.sizeBytes) && Number.isFinite(live.sizeBytes) && source.sizeBytes !== live.sizeBytes)) continue;
    byId.set(live.id, mergeHosting(byId.get(live.id) ?? source, live));
  }
  const current = [...byId.values()];
  cache = { at: Date.now(), documents: current };
  return current;
}

async function cloudinaryDocuments() {
  const folder = ROOT_FOLDER();
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

  return documents;
}

/**
 * Snapshot + live merge. The snapshot stays authoritative for titles and classification of
 * documents it knows (it is rebuilt from the share); the live record contributes the delivery
 * URL. Only catalogued source records are included, including records that are not hosted yet.
 */
export async function mergedDocuments({ includeLive = true, force = false } = {}) {
  const byId = new Map(snapshot.documents.filter(inSiteScope).map((doc) => [doc.id, doc]));

  if (includeLive) {
    try {
      for (const live of await liveDocuments({ force })) {
        const existing = byId.get(live.id);
        if (existing) byId.set(live.id, mergeHosting(existing, live));
      }
    } catch (error) {
      return { documents: [...byId.values()], liveError: String(error.message ?? error) };
    }
  }

  return { documents: [...byId.values()], liveError: null };
}
