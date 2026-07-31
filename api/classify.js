// POST /api/classify { fileName, relPath?, folder?, hints? }
// Returns the rule-based classification (region / province / zone / category / media kind).
// Public on purpose: the admin form uses it for live suggestions, and the MCP server reuses it.

import { classifyUpload } from "../server/classifyService.js";
import { readJsonBody, requireMethod, sendError, sendJson } from "../server/http.js";

export default async function handler(request, res) {
  if (!requireMethod(request, res, "POST")) return;

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return sendError(res, 400, "Body không hợp lệ.");
  }

  if (!body.fileName) return sendError(res, 400, "Thiếu fileName.");

  try {
    const classification = await classifyUpload(body);
    sendJson(res, 200, { classification });
  } catch (error) {
    sendError(res, 500, String(error.message ?? error));
  }
}
