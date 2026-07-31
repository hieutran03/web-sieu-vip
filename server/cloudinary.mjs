// Server-side Cloudinary client. No SDK: signed REST calls only, so the same module works in
// Node scripts, Vercel functions and the MCP server without extra dependencies.

import crypto from "node:crypto";

export const CLOUD_NAME = () => process.env.CLOUDINARY_CLOUD_NAME;
export const API_KEY = () => process.env.CLOUDINARY_API_KEY;
export const API_SECRET = () => process.env.CLOUDINARY_API_SECRET;
export const ROOT_FOLDER = () => process.env.CLOUDINARY_ROOT_FOLDER || "v-tnf";

export function assertCloudinaryConfigured() {
  const missing = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Cloudinary is not configured: missing ${missing.join(", ")}`);
}

/** Cloudinary signature: sha1 of `key=value&...` (sorted, signable params only) + api_secret. */
export function signParams(params, apiSecret = API_SECRET()) {
  const payload = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "" && key !== "file" && key !== "api_key" && key !== "resource_type")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(payload + apiSecret).digest("hex");
}

export function encodeContext(context = {}) {
  // Cloudinary context syntax: key=value|key=value ; `=` and `|` must be escaped.
  return Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${String(value).replace(/([=|])/g, "\\$1")}`)
    .join("|");
}

function adminUrl(pathname, search) {
  const url = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/${pathname}`);
  for (const [key, value] of Object.entries(search ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${API_KEY()}:${API_SECRET()}`).toString("base64")}`;
}

export async function adminRequest(pathname, { method = "GET", search, body } = {}) {
  assertCloudinaryConfigured();
  const response = await fetch(adminUrl(pathname, search), {
    method,
    headers: {
      Authorization: basicAuthHeader(),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Cloudinary ${method} ${pathname} failed (${response.status}): ${payload?.error?.message ?? text}`);
  }
  return payload;
}

/** Upload a buffer with a signed request. `resourceType` is image | video | raw. */
export async function uploadBuffer({ buffer, fileName, publicId, resourceType = "raw", tags = [], context = {}, overwrite = true }) {
  assertCloudinaryConfigured();

  const timestamp = Math.floor(Date.now() / 1000);
  const signable = {
    context: encodeContext(context),
    overwrite: String(Boolean(overwrite)),
    public_id: publicId,
    tags: tags.join(","),
    timestamp,
    unique_filename: "false",
    use_filename: "false"
  };
  const signature = signParams(signable);

  const form = new FormData();
  form.append("file", new Blob([buffer]), fileName);
  form.append("api_key", API_KEY());
  form.append("signature", signature);
  for (const [key, value] of Object.entries(signable)) {
    if (value !== "") form.append(key, String(value));
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/${resourceType}/upload`, {
    method: "POST",
    body: form
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `upload failed with status ${response.status}`);
  }
  return payload;
}

/** List resources under a folder prefix (paginated, all resource types). */
export async function listResources({ prefix, resourceType = "image", maxResults = 500, nextCursor } = {}) {
  return adminRequest(`resources/${resourceType}`, {
    search: { type: "upload", prefix, max_results: maxResults, next_cursor: nextCursor, context: "true", tags: "true" }
  });
}

/** Search API: one call across every resource type, filtered by expression. */
export async function searchResources({ expression, maxResults = 200, nextCursor, withField = ["context", "tags"] } = {}) {
  return adminRequest("resources/search", {
    method: "POST",
    body: { expression, max_results: maxResults, next_cursor: nextCursor, with_field: withField }
  });
}

export async function destroyResource({ publicId, resourceType = "raw" }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ public_id: publicId, timestamp });
  const form = new FormData();
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", API_KEY());
  form.append("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/${resourceType}/destroy`, { method: "POST", body: form });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? `destroy failed (${response.status})`);
  return payload;
}

export async function usage() {
  return adminRequest("usage");
}

/** Delivery URL for a stored resource (raw keeps its extension inside the public_id). */
export function deliveryUrl({ publicId, resourceType = "raw", version, format, transformation }) {
  const parts = [`https://res.cloudinary.com/${CLOUD_NAME()}/${resourceType}/upload`];
  if (transformation) parts.push(transformation);
  if (version) parts.push(`v${version}`);
  parts.push(format ? `${publicId}.${format}` : publicId);
  return parts.join("/");
}
