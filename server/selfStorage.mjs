// Client for the self-hosted file store (storage-server/, running on the always-on Linux box).
// Used for documents above the Cloudinary plan limits. Like server/cloudinary.mjs: no SDK, signed
// URLs only, so the same module works in scripts, Vercel functions and the MCP server.
//
// The signing scheme must match storage-server/server.mjs.

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { buildPublicId } from "./documentKeys.mjs";

export const STORAGE_URL = () => (process.env.STORAGE_PUBLIC_URL ?? "").replace(/\/+$/, "");
const SECRET = () => process.env.STORAGE_UPLOAD_SECRET ?? "";

const DEFAULT_TTL_SECONDS = 2 * 60 * 60;

export function selfStorageConfigured() {
  return Boolean(STORAGE_URL() && SECRET());
}

export function assertSelfStorageConfigured() {
  const missing = ["STORAGE_PUBLIC_URL", "STORAGE_UPLOAD_SECRET"].filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Self-hosted storage is not configured: missing ${missing.join(", ")}`);
}

function sign(method, key, exp, meta = "") {
  return crypto.createHmac("sha256", SECRET()).update(`${method}\n${key}\n${exp}\n${meta}`).digest("base64url");
}

function encodeKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Stored files always keep their extension, whatever Cloudinary resource type the doc maps to. */
export function storageKey(doc) {
  return buildPublicId({ ...doc, resourceType: "raw" });
}

export function publicUrl(key) {
  return `${STORAGE_URL()}/f/${encodeKey(key)}`;
}

/** The catalog fields worth keeping next to the file, so admin uploads can be listed back. */
export function storageMeta(doc) {
  const fields = [
    "id", "title", "fileName", "relPath", "collection", "category", "kind", "extension", "region",
    "provinceSlug", "provinceName", "zoneSlug", "zoneName", "language", "archived", "classifiedBy", "source"
  ];
  return Object.fromEntries(fields.filter((field) => doc[field] !== undefined && doc[field] !== null).map((field) => [field, doc[field]]));
}

export function signedUploadUrl(key, meta, { ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const exp = String(Math.floor(Date.now() / 1000) + ttlSeconds);
  const encodedMeta = meta ? Buffer.from(JSON.stringify(meta)).toString("base64url") : "";
  const params = new URLSearchParams({ exp, ...(encodedMeta ? { meta: encodedMeta } : {}), sig: sign("PUT", key, exp, encodedMeta) });
  return `${publicUrl(key)}?${params}`;
}

function signedUrl(method, pathname, key, extra = {}) {
  const exp = String(Math.floor(Date.now() / 1000) + 5 * 60);
  const params = new URLSearchParams({ ...extra, exp, sig: sign(method, key, exp) });
  return `${STORAGE_URL()}${pathname}?${params}`;
}

async function storageRequest(url, { method = "GET" } = {}) {
  const response = await fetch(url, { method });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Storage ${method} failed (${response.status}): ${payload.error ?? response.statusText}`);
  return payload;
}

export async function listStored({ prefix = "" } = {}) {
  assertSelfStorageConfigured();
  const payload = await storageRequest(signedUrl("LIST", "/list", prefix, { prefix }));
  return payload.items ?? [];
}

export async function deleteStored(key) {
  assertSelfStorageConfigured();
  return storageRequest(signedUrl("DELETE", `/f/${encodeKey(key)}`, key), { method: "DELETE" });
}

export async function storageHealth() {
  return storageRequest(`${STORAGE_URL()}/health`);
}

/**
 * Stream a local file to the store (scripts only). Uses node:http(s) rather than fetch: undici's
 * default timeouts abort uploads that take longer than five minutes, and a 600 MB report over a
 * home uplink easily does.
 */
export function uploadFile({ filePath, key, meta, onProgress }) {
  assertSelfStorageConfigured();
  const url = new URL(signedUploadUrl(key, meta));
  const size = fs.statSync(filePath).size;
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": size }
    });
    request.setTimeout(10 * 60 * 1000, () => request.destroy(new Error("Upload stalled for 10 minutes")));
    request.on("response", (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (text += chunk));
      response.on("end", () => {
        const payload = text ? JSON.parse(text) : {};
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(payload);
        else reject(new Error(payload.error ?? `upload failed with status ${response.statusCode}`));
      });
    });
    request.on("error", reject);

    let sent = 0;
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => {
      sent += chunk.length;
      onProgress?.(sent, size);
    });
    stream.on("error", (error) => request.destroy(error));
    stream.pipe(request);
  });
}

/** Rebuild a catalog-shaped document from a stored file + its sidecar metadata. */
export function documentFromStored(item) {
  const meta = item.meta ?? {};
  const fileName = meta.fileName ?? item.key.split("/").pop();
  return {
    ...meta,
    id: meta.id ?? item.key,
    fileName,
    title: meta.title ?? fileName.replace(/\.[A-Za-z0-9]+$/, ""),
    relPath: meta.relPath ?? "",
    collection: meta.collection ?? "misc",
    category: meta.category ?? "other",
    kind: meta.kind ?? "other",
    extension: meta.extension ?? fileName.split(".").pop() ?? "",
    language: meta.language ?? "vi",
    archived: meta.archived === true,
    source: meta.source ?? "selfhost",
    sizeBytes: item.bytes ?? 0,
    modifiedAt: meta.uploadedAt ?? item.modifiedAt ?? null,
    uploadable: true,
    selfhost: selfhostRecord(item.key, item.bytes, meta.uploadedAt ?? item.modifiedAt)
  };
}

export function selfhostRecord(key, bytes, uploadedAt = new Date().toISOString()) {
  return { key, url: publicUrl(key), bytes: bytes ?? 0, uploadedAt };
}
