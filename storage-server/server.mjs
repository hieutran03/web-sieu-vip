// Self-hosted file store for documents too large for the Cloudinary plan.
// Zero dependencies (Node >= 20). Runs on the always-on Linux box, exposed via Tailscale Funnel.
//
//   GET|HEAD /f/<key>[?dl=<file name>]     public read, Range support (PDF viewer, video seeking)
//   PUT      /f/<key>?exp=&meta=&sig=      signed upload, streamed to disk (no size cap besides MAX_BYTES)
//   DELETE   /f/<key>?exp=&sig=            signed delete
//   GET      /list?prefix=&exp=&sig=       signed listing (key, bytes, modifiedAt, meta)
//   GET      /health                       liveness + free disk space
//   GET      /tunnel                       current fast public URL (Cloudflare quick tunnel) or null
//
// Tailscale Funnel throttles each connection to roughly 0.2 MB/s, so reads also go out through a
// free Cloudflare quick tunnel (the `tunnel` service in docker-compose.yml). Its hostname changes
// on every restart: this server reads it from cloudflared's metrics endpoint, checks it end to
// end, and publishes it on /tunnel. The site asks the stable Funnel URL for it and falls back to
// Funnel whenever it is null or stops answering. Uploads, deletes and listings stay on Funnel.
//
// Signatures: base64url(HMAC-SHA256(UPLOAD_SECRET, `${METHOD}\n${key}\n${exp}\n${meta}`)).
// The same scheme lives in ../server/selfStorage.mjs (the side that issues signed URLs);
// it is duplicated on purpose so this folder can be built and deployed on its own.

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = path.resolve(process.env.STORAGE_DIR ?? "./data");
const FILES_DIR = path.join(DATA_DIR, "files");
const META_DIR = path.join(DATA_DIR, "meta");
const TMP_DIR = path.join(DATA_DIR, "tmp");
const SECRET = process.env.UPLOAD_SECRET ?? "";
const MAX_BYTES = Number(process.env.MAX_BYTES ?? 5 * 1024 * 1024 * 1024);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((origin) => origin.trim()).filter(Boolean);
// cloudflared's metrics server, e.g. http://tunnel:20241. Unset: no fast tunnel, /tunnel says null.
const TUNNEL_METRICS_URL = (process.env.TUNNEL_METRICS_URL ?? "").replace(/\/+$/, "");
const TUNNEL_CHECK_MS = 30 * 1000;

if (SECRET.length < 32) {
  console.error("UPLOAD_SECRET must be set to a random string of at least 32 characters.");
  process.exit(1);
}

for (const dir of [FILES_DIR, META_DIR, TMP_DIR]) fs.mkdirSync(dir, { recursive: true });

const CONTENT_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  dwg: "application/acad",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json"
};

/* ─── Signing ─────────────────────────────────────────────────────── */

function sign(method, key, exp, meta = "") {
  return crypto.createHmac("sha256", SECRET).update(`${method}\n${key}\n${exp}\n${meta}`).digest("base64url");
}

function verifySignature(method, key, params) {
  const exp = params.get("exp") ?? "";
  const sig = params.get("sig") ?? "";
  const meta = params.get("meta") ?? "";
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  const expected = sign(method, key, exp, meta);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/* ─── Keys and paths ──────────────────────────────────────────────── */

const SEGMENT = /^[A-Za-z0-9._-]{1,120}$/;

/** Keys look like `v-tnf/zone-geology/south/<province>/<zone>/<file>_<hash>.pdf`. */
function parseKey(raw) {
  let key;
  try {
    key = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (key.length > 400) return null;
  const segments = key.split("/");
  if (!segments.every((segment) => SEGMENT.test(segment) && segment !== "." && segment !== "..")) return null;
  return key;
}

function filePath(key) {
  return path.join(FILES_DIR, ...key.split("/"));
}

function metaPath(key) {
  return path.join(META_DIR, ...key.split("/")) + ".json";
}

async function readMeta(key) {
  try {
    return JSON.parse(await fsp.readFile(metaPath(key), "utf8"));
  } catch {
    return null;
  }
}

/* ─── HTTP helpers ────────────────────────────────────────────────── */

function setCors(request, response) {
  const origin = request.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) response.setHeader("Access-Control-Allow-Origin", "*");
  else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  response.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, ETag");
  response.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
  response.end(body);
}

function contentDisposition(type, fileName) {
  // ASCII fallback for old clients + RFC 5987 UTF-8 name for Vietnamese / Japanese file names.
  const fallback =
    fileName.replace(/Đ/g, "D").replace(/đ/g, "d").normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "download";
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/* ─── Handlers ────────────────────────────────────────────────────── */

async function handleRead(request, response, key, params) {
  const target = filePath(key);
  let stat;
  try {
    stat = await fsp.stat(target);
  } catch {
    return sendJson(response, 404, { error: "Not found" });
  }
  if (!stat.isFile()) return sendJson(response, 404, { error: "Not found" });

  const meta = await readMeta(key);
  const extension = path.extname(key).slice(1).toLowerCase();
  const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  const download = params.get("dl");
  const fileName = download || meta?.fileName || path.basename(key);

  const headers = {
    "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
    // Requests through the Cloudflare tunnel carry cf-ray. Keep them out of Cloudflare's edge
    // cache: on a miss it fetches the whole file before answering a range, which would stall
    // PDF.js (it reads the end of the file first) for as long as a full download takes.
    "Cache-Control": request.headers["cf-ray"] ? "private, max-age=3600" : "public, max-age=3600",
    "Content-Disposition": contentDisposition(download ? "attachment" : "inline", fileName),
    "X-Content-Type-Options": "nosniff"
  };

  if (request.headers["if-none-match"] === etag) {
    response.writeHead(304, headers);
    return response.end();
  }

  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
  if (range && stat.size > 0) {
    if (range[1] === "") {
      start = Math.max(0, stat.size - Number(range[2]));
    } else {
      start = Number(range[1]);
      if (range[2] !== "") end = Math.min(end, Number(range[2]));
    }
    if (start > end || start >= stat.size) {
      response.writeHead(416, { ...headers, "Content-Range": `bytes */${stat.size}` });
      return response.end();
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
  }

  headers["Content-Length"] = stat.size === 0 ? 0 : end - start + 1;
  response.writeHead(status, headers);
  if (request.method === "HEAD" || stat.size === 0) return response.end();
  await pipeline(fs.createReadStream(target, { start, end }), response);
}

async function handleUpload(request, response, key, params) {
  if (!verifySignature("PUT", key, params)) return sendJson(response, 403, { error: "Invalid or expired signature" });

  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > MAX_BYTES) return sendJson(response, 413, { error: `File exceeds ${MAX_BYTES} bytes` });

  let meta = null;
  if (params.get("meta")) {
    try {
      meta = JSON.parse(Buffer.from(params.get("meta"), "base64url").toString("utf8"));
    } catch {
      return sendJson(response, 400, { error: "Invalid meta" });
    }
  }

  // Write to a temp file first, then rename: readers never see a half-written document.
  const temp = path.join(TMP_DIR, `${crypto.randomUUID()}.part`);
  let received = 0;
  try {
    await pipeline(
      request,
      async function* limit(source) {
        for await (const chunk of source) {
          received += chunk.length;
          if (received > MAX_BYTES) throw Object.assign(new Error("File too large"), { status: 413 });
          yield chunk;
        }
      },
      fs.createWriteStream(temp)
    );
    if (declared && received !== declared) throw Object.assign(new Error("Upload incomplete"), { status: 400 });

    const target = filePath(key);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.rename(temp, target);

    const stored = { ...(meta ?? {}), key, bytes: received, uploadedAt: new Date().toISOString() };
    await fsp.mkdir(path.dirname(metaPath(key)), { recursive: true });
    await fsp.writeFile(metaPath(key), JSON.stringify(stored), "utf8");

    console.log(`PUT ${key} (${(received / 1024 / 1024).toFixed(1)} MB)`);
    sendJson(response, 201, { key, bytes: received, uploadedAt: stored.uploadedAt });
  } catch (error) {
    await fsp.rm(temp, { force: true });
    if (!response.headersSent) sendJson(response, error.status ?? 500, { error: String(error.message ?? error) });
  }
}

async function handleDelete(response, key, params) {
  if (!verifySignature("DELETE", key, params)) return sendJson(response, 403, { error: "Invalid or expired signature" });
  const existed = fs.existsSync(filePath(key));
  await fsp.rm(filePath(key), { force: true });
  await fsp.rm(metaPath(key), { force: true });
  console.log(`DELETE ${key}`);
  sendJson(response, 200, { key, result: existed ? "ok" : "not found" });
}

async function walk(dir, base = "") {
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  const keys = [];
  for (const entry of entries) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) keys.push(...(await walk(path.join(dir, entry.name), relative)));
    else if (entry.isFile()) keys.push(relative);
  }
  return keys;
}

async function handleList(response, params) {
  const prefix = params.get("prefix") ?? "";
  if (!verifySignature("LIST", prefix, params)) return sendJson(response, 403, { error: "Invalid or expired signature" });

  const items = [];
  for (const key of await walk(FILES_DIR)) {
    if (prefix && !key.startsWith(prefix)) continue;
    const stat = await fsp.stat(filePath(key));
    items.push({ key, bytes: stat.size, modifiedAt: stat.mtime.toISOString(), meta: await readMeta(key) });
  }
  sendJson(response, 200, { count: items.length, items });
}

async function handleHealth(response) {
  const disk = await fsp.statfs(DATA_DIR).catch(() => null);
  sendJson(response, 200, {
    ok: true,
    time: new Date().toISOString(),
    freeBytes: disk ? disk.bavail * disk.bsize : null,
    maxUploadBytes: MAX_BYTES
  });
}

/* ─── Fast tunnel ─────────────────────────────────────────────────── */

const tunnel = { url: null, checkedAt: null };

async function checkTunnel() {
  let url = null;
  try {
    const info = await fetch(`${TUNNEL_METRICS_URL}/quicktunnel`, { signal: AbortSignal.timeout(5000) }).then((res) => res.json());
    const hostname = typeof info?.hostname === "string" ? info.hostname.trim() : "";
    if (/^[a-z0-9.-]+$/i.test(hostname)) {
      // End to end through Cloudflare: a fresh hostname takes a few seconds to resolve.
      const health = await fetch(`https://${hostname}/health`, { signal: AbortSignal.timeout(10 * 1000) });
      if (health.ok && (await health.json())?.ok === true) url = `https://${hostname}`;
    }
  } catch {
    // cloudflared restarting, or the tunnel not reachable yet: serve Funnel only until it is.
  }
  if (url !== tunnel.url) console.log(url ? `fast tunnel up: ${url}` : "fast tunnel down, Funnel only");
  tunnel.url = url;
  tunnel.checkedAt = new Date().toISOString();
}

function handleTunnel(response) {
  sendJson(response, 200, tunnel);
}

if (TUNNEL_METRICS_URL) {
  checkTunnel();
  setInterval(checkTunnel, TUNNEL_CHECK_MS).unref();
}

/* ─── Server ──────────────────────────────────────────────────────── */

const server = http.createServer(async (request, response) => {
  setCors(request, response);
  const url = new URL(request.url ?? "/", "http://localhost");

  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      return response.end();
    }
    if (url.pathname === "/health" && request.method === "GET") return await handleHealth(response);
    if (url.pathname === "/tunnel" && request.method === "GET") return handleTunnel(response);
    if (url.pathname === "/list" && request.method === "GET") return await handleList(response, url.searchParams);

    if (url.pathname.startsWith("/f/")) {
      const key = parseKey(url.pathname.slice(3));
      if (!key) return sendJson(response, 400, { error: "Invalid key" });
      if (request.method === "GET" || request.method === "HEAD") return await handleRead(request, response, key, url.searchParams);
      if (request.method === "PUT") return await handleUpload(request, response, key, url.searchParams);
      if (request.method === "DELETE") return await handleDelete(response, key, url.searchParams);
      response.setHeader("Allow", "GET, HEAD, PUT, DELETE, OPTIONS");
      return sendJson(response, 405, { error: "Method not allowed" });
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    // Client aborted a download or upload: nothing left to answer.
    if (error.code === "ERR_STREAM_PREMATURE_CLOSE") return;
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: "Internal error" });
    else response.destroy();
  }
});

// Large uploads over a home connection take minutes: Node's default 5-minute request timeout
// would cut a 600 MB report in half.
server.requestTimeout = 0;
server.headersTimeout = 60 * 1000;
server.keepAliveTimeout = 65 * 1000;

server.listen(PORT, () => console.log(`storage-server listening on :${PORT}, data in ${DATA_DIR}`));
