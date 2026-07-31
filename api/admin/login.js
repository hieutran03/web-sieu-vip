// POST /api/admin/login { password } -> { token, expiresAt }
// The token is required by /api/admin/* endpoints (upload signature, delete).

import { adminAuthConfigured, issueToken, verifyPassword } from "../../server/auth.mjs";
import { readJsonBody, requireMethod, sendError, sendJson } from "../../server/http.js";

const attempts = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function rateLimited(key) {
  const now = Date.now();
  const entry = attempts.get(key) ?? { count: 0, first: now };
  if (now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  attempts.set(key, entry);
  return entry.count > MAX_ATTEMPTS;
}

export default async function handler(request, res) {
  if (!requireMethod(request, res, "POST")) return;
  if (!adminAuthConfigured()) {
    return sendError(res, 503, "Chưa cấu hình ADMIN_PASSWORD / ADMIN_TOKEN_SECRET trên server.");
  }

  const clientKey = request.headers["x-forwarded-for"] ?? request.socket?.remoteAddress ?? "local";
  if (rateLimited(String(clientKey))) {
    return sendError(res, 429, "Quá nhiều lần thử. Vui lòng chờ vài phút.");
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return sendError(res, 400, "Body không hợp lệ.");
  }

  if (!verifyPassword(body.password)) {
    return sendError(res, 401, "Mật khẩu không đúng.");
  }

  const { token, expiresAt } = issueToken();
  sendJson(res, 200, { token, expiresAt, role: "admin" });
}
