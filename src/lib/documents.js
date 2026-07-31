// Client data layer for the document library: the committed catalog snapshot, the province
// geometry, Cloudinary delivery URLs and the small API client used by the admin flow.

import catalog from "../data/documentCatalog.json";
import provinceGeo from "../data/vietnamProvinces.geo.json";
import { buildStats, filterDocuments, isHosted } from "../shared/catalogStats.js";
import { CATEGORIES, CATEGORY_BY_ID, MEDIA_KINDS } from "../shared/classify.js";
import { PROVINCE_BY_SLUG, REGIONS } from "../shared/provinceMeta.js";
import { inSiteScope } from "../shared/scope.js";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "";

export { CATEGORIES, CATEGORY_BY_ID, MEDIA_KINDS, REGIONS, PROVINCE_BY_SLUG, filterDocuments, isHosted };

export const catalogMeta = {
  generatedAt: catalog.generatedAt,
  sourceRoot: catalog.sourceRoot,
  uploadedAt: catalog.uploadedAt ?? null
};

export const provinceFeatures = provinceGeo.features;

/**
 * Merge admin uploads (fetched live) into the bundled snapshot, keyed by document id.
 * For documents that exist in both, the snapshot stays authoritative for titles and
 * classification (it is rebuilt from the share) and the live record only supplies the
 * delivery URL. Documents that only exist live — i.e. admin uploads — are added as-is.
 */
export function mergeDocuments(snapshotDocuments, liveDocuments = []) {
  if (!liveDocuments.length) return snapshotDocuments;
  const byId = new Map(snapshotDocuments.map((doc) => [doc.id, doc]));
  for (const live of liveDocuments) {
    const existing = byId.get(live.id);
    if (existing) {
      byId.set(live.id, { ...existing, cloudinary: live.cloudinary ?? existing.cloudinary });
    } else if (inSiteScope(live)) {
      // New upload the snapshot has not seen yet — only if it belongs on this site.
      byId.set(live.id, live);
    }
  }
  return [...byId.values()];
}

export const snapshotDocuments = catalog.documents;

export function computeStats(documents) {
  return buildStats(documents);
}

/* ─── Cloudinary delivery ─────────────────────────────────────────── */

function withTransformation(secureUrl, transformation, extension) {
  if (!secureUrl) return null;
  const transformed = secureUrl.replace("/upload/", `/upload/${transformation}/`);
  return extension ? transformed.replace(/\.[A-Za-z0-9]+$/, `.${extension}`) : transformed;
}

/**
 * Preview image for a document card:
 * images get a resized crop, PDFs get their first page rendered as JPEG,
 * videos get a poster frame. Everything else has no raster preview.
 */
export function thumbnailUrl(doc, { width = 480, height = 320 } = {}) {
  const url = doc.cloudinary?.secureUrl;
  if (!url) return null;
  if (doc.kind === "image") return withTransformation(url, `c_fill,g_auto,w_${width},h_${height},f_auto,q_auto`);
  if (doc.kind === "pdf") return withTransformation(url, `c_fill,g_north,w_${width},h_${height},pg_1,f_jpg,q_auto`, "jpg");
  if (doc.kind === "video") return withTransformation(url, `c_fill,w_${width},h_${height},so_1,f_jpg,q_auto`, "jpg");
  return null;
}

/** Full-size viewing URL (PDF/image inline, video streamed, raw downloaded). */
export function viewUrl(doc) {
  return doc.cloudinary?.secureUrl ?? null;
}

/** Force a download with the original file name. */
export function downloadUrl(doc) {
  const url = doc.cloudinary?.secureUrl;
  if (!url) return null;
  return withTransformation(url, `fl_attachment:${encodeURIComponent(doc.fileName.replace(/\.[A-Za-z0-9]+$/, ""))}`);
}

export function canPreviewInline(doc) {
  return doc.kind === "image" || doc.kind === "pdf" || doc.kind === "video";
}

export const cloudinaryConfigured = Boolean(CLOUD_NAME);

/* ─── Formatting ──────────────────────────────────────────────────── */

export function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(value, language = "vi") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(language === "vi" ? "vi-VN" : language === "ja" ? "ja-JP" : "en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

/* ─── API client ──────────────────────────────────────────────────── */

async function request(path, { method = "GET", body, token, signal } = {}) {
  const response = await fetch(path, {
    method,
    signal,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

export const api = {
  health: (signal) => request("/api/health", { signal }),
  liveDocuments: (signal) => request("/api/documents?scope=live", { signal }),
  analyze: ({ region, province, zone, language, ai, signal } = {}) => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (province) params.set("province", province);
    if (zone) params.set("zone", zone);
    if (language) params.set("language", language);
    if (ai !== undefined) params.set("ai", ai ? "1" : "0");
    return request(`/api/analyze?${params.toString()}`, { signal });
  },
  classify: (body, signal) => request("/api/classify", { method: "POST", body, signal }),
  login: (password) => request("/api/admin/login", { method: "POST", body: { password } }),
  uploadSignature: (body, token) => request("/api/admin/upload-signature", { method: "POST", body, token }),
  remove: (body, token) => request("/api/admin/delete", { method: "POST", body, token })
};

/**
 * Upload a file straight to Cloudinary using a server-issued signature.
 * XHR (not fetch) so the admin panel can show real progress.
 */
export function uploadToCloudinary({ file, uploadUrl, fields, onProgress }) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      try {
        const payload = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
        else reject(new Error(payload?.error?.message ?? `Cloudinary upload failed (${xhr.status})`));
      } catch (error) {
        reject(error);
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Không kết nối được tới Cloudinary")));
    xhr.send(form);
  });
}

const TOKEN_STORAGE_KEY = "v-tnf-admin-token";

export const adminSession = {
  read() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session?.token || new Date(session.expiresAt).getTime() < Date.now()) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },
  write(session) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(session));
  },
  clear() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};
