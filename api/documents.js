// GET /api/documents?region=&province=&zone=&category=&collection=&kind=&query=&hostedOnly=&scope=
//   scope=merged (default) snapshot + Cloudinary, scope=live only Cloudinary, scope=snapshot no network.
// Used by the app to pick up admin uploads without a rebuild, and by the MCP server.

import { filterDocuments } from "../src/shared/catalogStats.js";
import { catalogSnapshot, liveDocuments, mergedDocuments } from "../server/catalogSource.js";
import { getQuery, requireMethod, sendError, sendJson } from "../server/http.js";

export default async function handler(request, res) {
  if (!requireMethod(request, res, "GET")) return;

  const query = getQuery(request);
  const scope = query.scope ?? "merged";
  const limit = Math.min(Number(query.limit) || 2000, 5000);

  try {
    let documents;
    let liveError = null;

    if (scope === "snapshot") {
      documents = catalogSnapshot().documents;
    } else if (scope === "live") {
      documents = await liveDocuments({ force: query.refresh === "1" });
    } else {
      const merged = await mergedDocuments({ force: query.refresh === "1" });
      documents = merged.documents;
      liveError = merged.liveError;
    }

    const filtered = filterDocuments(documents, {
      region: query.region,
      province: query.province,
      zone: query.zone,
      category: query.category,
      collection: query.collection,
      kind: query.kind,
      language: query.language,
      query: query.query,
      hostedOnly: query.hostedOnly === "1" || query.hostedOnly === "true"
    });

    sendJson(res, 200, {
      scope,
      count: filtered.length,
      total: documents.length,
      generatedAt: catalogSnapshot().generatedAt,
      liveError,
      documents: filtered.slice(0, limit)
    });
  } catch (error) {
    sendError(res, 500, String(error.message ?? error));
  }
}
