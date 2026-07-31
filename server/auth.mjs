// Admin session tokens: HMAC-signed, stateless, 8 hours. No database, no third-party dependency.
// The password and the signing secret only ever exist as server env vars.

import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function adminAuthConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_TOKEN_SECRET);
}

/** Constant-time password check so failures do not leak timing information. */
export function verifyPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(String(candidate ?? ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function issueToken({ subject = "admin", ttlSeconds = TOKEN_TTL_SECONDS } = {}) {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET is not configured");

  const claims = { sub: subject, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const payload = base64url(JSON.stringify(claims));
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt: new Date(claims.exp * 1000).toISOString() };
}

export function verifyToken(token) {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret || typeof token !== "string" || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  const expected = sign(payload, secret);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Reads the bearer token from a Vercel/Node request and returns the claims, or null. */
export function authenticate(request) {
  const header = request.headers?.authorization ?? request.headers?.get?.("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? verifyToken(match[1].trim()) : null;
}
