// Single source of truth for how a document maps onto Cloudinary: public_id, tags and context.
// Both the bulk upload script and the admin upload endpoint go through here so the metadata
// stays queryable (the MCP server and /api/documents rely on these tags).

import { publicIdSegment, slugify } from "../src/shared/text.js";
import { ROOT_FOLDER } from "./cloudinary.mjs";

const MAX_SEGMENT = 60;
const MAX_PUBLIC_ID = 200;

function segment(value, fallback = "unassigned") {
  const cleaned = publicIdSegment(value ?? "").slice(0, MAX_SEGMENT);
  return cleaned || fallback;
}

/**
 * v-tnf/<collection>/<region>/<province>/<zone>/<file>_<hash>
 * Raw resources keep their extension in the public_id, images/videos do not.
 *
 * The `_<hash>` suffix is derived from the source path and is not decoration: the same file name
 * legitimately appears in several folders (the TCVN drafts exist in three), and CJK-only names
 * such as `一軸圧縮試験.mov` reduce to an empty ASCII segment. Without it those documents share a
 * public_id and overwrite each other on upload.
 */
export function buildPublicId(doc, { root = ROOT_FOLDER() } = {}) {
  const extension = doc.extension ? `.${doc.extension}` : "";
  const base = doc.fileName.replace(/\.[A-Za-z0-9]+$/, "");
  const fingerprint = Math.abs(hash(doc.relPath || doc.fileName)).toString(36).padStart(6, "0").slice(0, 7);
  const leaf = `${segment(base, doc.kind ?? "document")}_${fingerprint}`;

  const parts = [
    root,
    segment(doc.collection, "misc"),
    segment(doc.region, "unassigned"),
    segment(doc.provinceSlug, "unassigned"),
    ...(doc.zoneSlug ? [segment(doc.zoneSlug)] : []),
    leaf
  ];

  let publicId = parts.join("/");
  if (publicId.length > MAX_PUBLIC_ID) {
    // Trim the readable part, never the fingerprint.
    const keep = MAX_PUBLIC_ID - fingerprint.length - 1;
    publicId = publicId.slice(0, keep) + `_${fingerprint}`;
  }
  return doc.resourceType === "raw" ? publicId + extension : publicId;
}

export function buildTags(doc) {
  return [
    "v-tnf",
    `collection:${doc.collection ?? "misc"}`,
    `category:${doc.category ?? "other"}`,
    `kind:${doc.kind ?? "other"}`,
    `region:${doc.region ?? "unassigned"}`,
    `province:${doc.provinceSlug ?? "unassigned"}`,
    ...(doc.zoneSlug ? [`zone:${doc.zoneSlug}`] : []),
    `lang:${doc.language ?? "vi"}`,
    ...(doc.archived ? ["archived"] : []),
    `source:${doc.source ?? "share"}`
  ].map((tag) => tag.replace(/[^\w:.\-]/g, "-"));
}

export function buildContext(doc) {
  return {
    doc_id: doc.id,
    title: doc.title ?? doc.fileName,
    file_name: doc.fileName,
    rel_path: doc.relPath ?? "",
    collection: doc.collection ?? "misc",
    category: doc.category ?? "other",
    kind: doc.kind ?? "other",
    region: doc.region ?? "",
    province: doc.provinceSlug ?? "",
    province_name: doc.provinceName ?? "",
    zone: doc.zoneSlug ?? "",
    zone_name: doc.zoneName ?? "",
    language: doc.language ?? "vi",
    classified_by: doc.classifiedBy ?? "rules",
    source: doc.source ?? "share",
    uploaded_at: new Date().toISOString()
  };
}

/** Rebuild a catalog-shaped document from a Cloudinary resource (context + tags round-trip). */
export function documentFromResource(resource) {
  const context = resource.context?.custom ?? resource.context ?? {};
  const tags = resource.tags ?? [];
  const tagValue = (prefix) => tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1) ?? null;
  const kind = context.kind ?? tagValue("kind") ?? resource.resource_type;

  return {
    id: context.doc_id ?? resource.public_id,
    relPath: context.rel_path ?? "",
    fileName: context.file_name ?? resource.public_id.split("/").pop(),
    title: context.title ?? context.file_name ?? resource.public_id.split("/").pop(),
    collection: context.collection ?? tagValue("collection") ?? "misc",
    category: context.category ?? tagValue("category") ?? "other",
    kind,
    extension: resource.format ?? "",
    region: context.region || tagValue("region") || null,
    provinceSlug: context.province || tagValue("province") || null,
    provinceName: context.province_name || null,
    zoneSlug: context.zone || tagValue("zone") || null,
    zoneName: context.zone_name || null,
    language: context.language ?? tagValue("lang") ?? "vi",
    archived: tags.includes("archived"),
    classifiedBy: context.classified_by ?? "rules",
    source: context.source ?? tagValue("source") ?? "cloudinary",
    sizeBytes: resource.bytes ?? 0,
    modifiedAt: resource.created_at ?? null,
    uploadable: true,
    resourceType: resource.resource_type,
    cloudinary: {
      publicId: resource.public_id,
      resourceType: resource.resource_type,
      version: resource.version,
      format: resource.format ?? null,
      bytes: resource.bytes ?? 0,
      secureUrl: resource.secure_url,
      uploadedAt: resource.created_at ?? null,
      pages: resource.pages ?? null
    }
  };
}

export function zoneKey(provinceSlug, zoneSlug) {
  return `${provinceSlug ?? "unassigned"}/${zoneSlug ?? "unassigned"}`;
}

export function slugKey(value) {
  return slugify(value ?? "");
}

function hash(value) {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) result = (result * 31 + value.charCodeAt(i)) | 0;
  return result;
}
