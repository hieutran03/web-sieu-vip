// Tiny request/response helpers so the API handlers work unchanged under `vercel dev`,
// in production on Vercel and inside the Vite dev middleware.

import { authenticate } from "./auth.mjs";

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

export function sendError(res, status, message, extra = {}) {
  sendJson(res, status, { error: message, ...extra });
}

export async function readJsonBody(request, { limitBytes = 1024 * 1024 } = {}) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string" && request.body) return JSON.parse(request.body);

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function getQuery(request) {
  if (request.query) return request.query;
  const url = new URL(request.url ?? "/", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

export function requireMethod(request, res, ...methods) {
  if (methods.includes(request.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  sendError(res, 405, `Method ${request.method} not allowed`);
  return false;
}

/** Returns the admin claims, or null after having written a 401 response. */
export function requireAdmin(request, res) {
  const claims = authenticate(request);
  if (!claims) {
    sendError(res, 401, "Cần đăng nhập bằng quyền admin (thiếu hoặc hết hạn token).");
    return null;
  }
  return claims;
}
