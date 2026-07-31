// POST /api/admin/delete { publicId, resourceType } (admin token required)
// Removes a document that was uploaded by mistake. Only assets under the configured root folder.

import { destroyResource, ROOT_FOLDER } from "../../server/cloudinary.mjs";
import { readJsonBody, requireAdmin, requireMethod, sendError, sendJson } from "../../server/http.js";

export default async function handler(request, res) {
  if (!requireMethod(request, res, "POST")) return;
  if (!requireAdmin(request, res)) return;

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return sendError(res, 400, "Body không hợp lệ.");
  }

  const { publicId, resourceType = "raw" } = body;
  if (!publicId) return sendError(res, 400, "Thiếu publicId.");
  if (!publicId.startsWith(`${ROOT_FOLDER()}/`)) {
    return sendError(res, 403, `Chỉ được xóa tài liệu trong thư mục ${ROOT_FOLDER()}/.`);
  }

  try {
    const result = await destroyResource({ publicId, resourceType });
    sendJson(res, 200, { result: result.result, publicId });
  } catch (error) {
    sendError(res, 500, String(error.message ?? error));
  }
}
