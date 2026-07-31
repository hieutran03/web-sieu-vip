// POST /api/admin/upload-signature (admin token required)
//   { fileName, sizeBytes, hints?: { region, provinceSlug, zoneName, category, collection }, title? }
// -> everything the browser needs to upload straight to Cloudinary.
//
// The file never passes through this function (Vercel bodies are capped at a few MB): the client
// posts it directly to Cloudinary with the signature below, so the API secret stays server-side.

import { CLOUD_NAME, API_KEY, ROOT_FOLDER, encodeContext, signParams } from "../../server/cloudinary.mjs";
import { classifyUpload } from "../../server/classifyService.js";
import { buildContext, buildPublicId, buildTags } from "../../server/documentKeys.mjs";
import { readJsonBody, requireAdmin, requireMethod, sendError, sendJson } from "../../server/http.js";

const LIMITS = { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024, raw: 10 * 1024 * 1024 };

export default async function handler(request, res) {
  if (!requireMethod(request, res, "POST")) return;
  if (!requireAdmin(request, res)) return;
  if (!CLOUD_NAME() || !API_KEY() || !process.env.CLOUDINARY_API_SECRET) {
    return sendError(res, 503, "Cloudinary chưa được cấu hình trên server.");
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return sendError(res, 400, "Body không hợp lệ.");
  }

  const { fileName, sizeBytes = 0 } = body;
  if (!fileName) return sendError(res, 400, "Thiếu fileName.");

  const classification = await classifyUpload({
    fileName,
    relPath: body.relPath ?? fileName,
    folder: body.folder,
    hints: body.hints
  });

  const limit = LIMITS[classification.resourceType];
  if (sizeBytes && sizeBytes > limit) {
    return sendError(res, 413, `Tệp ${(sizeBytes / 1024 / 1024).toFixed(1)} MB vượt giới hạn ${(limit / 1024 / 1024).toFixed(0)} MB của gói Cloudinary hiện tại.`, {
      limitBytes: limit
    });
  }

  const doc = {
    id: body.docId ?? `admin-${Date.now().toString(36)}`,
    fileName,
    title: body.title ?? fileName.replace(/\.[A-Za-z0-9]+$/, ""),
    relPath: body.relPath ?? fileName,
    sizeBytes,
    ...classification,
    source: "admin"
  };

  const publicId = buildPublicId(doc, { root: ROOT_FOLDER() });
  const tags = buildTags(doc);
  const context = { ...buildContext(doc), uploaded_by: "admin" };

  const timestamp = Math.floor(Date.now() / 1000);
  const signable = {
    context: encodeContext(context),
    overwrite: "true",
    public_id: publicId,
    tags: tags.join(","),
    timestamp,
    unique_filename: "false",
    use_filename: "false"
  };

  sendJson(res, 200, {
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/${classification.resourceType}/upload`,
    fields: { ...signable, api_key: API_KEY(), signature: signParams(signable) },
    resourceType: classification.resourceType,
    publicId,
    tags,
    classification,
    document: { ...doc, cloudinary: null }
  });
}
