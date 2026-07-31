#!/usr/bin/env node
// MCP server for the V-TNF document library.
//
// Gives an AI agent first-class access to the same data the web app uses: the document catalog
// (regions / provinces / industrial parks / categories), Cloudinary delivery URLs, the rule-based
// classifier, catalog statistics, and — when a token is supplied — document upload.
//
// Run:            npm run mcp
// Claude Code:    already registered in .mcp.json (stdio transport)
//
// Environment: reads .env.local from the repo root (Cloudinary + admin + Gemini keys).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { buildNarrative, buildStats, filterDocuments } from "../src/shared/catalogStats.js";
import { CATEGORIES, COLLECTIONS, MEDIA_KINDS } from "../src/shared/classify.js";
import { PROVINCES, REGIONS } from "../src/shared/provinceMeta.js";
import { classifyUpload } from "../server/classifyService.js";
import { assertCloudinaryConfigured, uploadBuffer, usage } from "../server/cloudinary.mjs";
import { buildContext, buildPublicId, buildTags } from "../server/documentKeys.mjs";
import { liveDocuments, mergedDocuments } from "../server/catalogSource.js";
import { loadEnv, REPO_ROOT } from "../scripts/lib/env.mjs";

loadEnv();

const HERE = path.dirname(fileURLToPath(import.meta.url));

function text(payload) {
  return { content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }] };
}

function compactDocument(doc) {
  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    region: doc.region,
    province: doc.provinceSlug,
    provinceName: doc.provinceName,
    zone: doc.zoneSlug,
    zoneName: doc.zoneName,
    category: doc.category,
    collection: doc.collection,
    kind: doc.kind,
    sizeBytes: doc.sizeBytes,
    modifiedAt: doc.modifiedAt,
    hosted: Boolean(doc.cloudinary?.secureUrl),
    url: doc.cloudinary?.secureUrl ?? null,
    sharePath: doc.relPath || null
  };
}

/**
 * Snapshot by default: it already covers the whole site scope and answers instantly. Pass
 * live=true to also pull documents uploaded through the admin panel since the last catalog build
 * (that call goes out to Cloudinary and takes a few seconds).
 */
async function getDocuments({ live = false } = {}) {
  const { documents, liveError } = await mergedDocuments({ includeLive: live });
  return { documents, liveError };
}

const server = new McpServer({
  name: "v-tnf-documents",
  version: "1.0.0",
  description: "V-TNF technical document library: industrial parks, geology records and standards by region and province."
});

server.registerTool(
  "list_taxonomy",
  {
    title: "List taxonomy",
    description:
      "The controlled vocabulary of the library: macro regions, the 63 provinces (with their post-2025 merged unit), document categories, collections and media kinds. Call this first to learn valid filter values.",
    inputSchema: {}
  },
  async () =>
    text({
      regions: REGIONS.map((region) => ({ id: region.id, name: region.name.vi, folder: region.folder })),
      provinces: PROVINCES.map((province) => ({ slug: province.slug, name: province.name, region: province.region, mergedInto: province.mergedInto })),
      categories: CATEGORIES.map((category) => ({ id: category.id, name: category.label.vi })),
      collections: COLLECTIONS.map((collection) => ({ id: collection.id, name: collection.label.vi })),
      kinds: Object.values(MEDIA_KINDS).map((kind) => ({ id: kind.id, name: kind.label.vi, extensions: kind.extensions }))
    })
);

server.registerTool(
  "search_documents",
  {
    title: "Search documents",
    description:
      "Search the document catalog by any combination of region, province slug, industrial park slug, category, collection, media kind and free text. Returns compact records including the Cloudinary URL when the document is hosted.",
    inputSchema: {
      query: z.string().optional().describe("Free text matched against title, file name, park and province"),
      region: z.enum(["north", "central", "south"]).optional(),
      province: z.string().optional().describe("Province slug, e.g. bac-ninh"),
      zone: z.string().optional().describe("Industrial park slug, e.g. thang-long-ii"),
      category: z.string().optional().describe("Category id from list_taxonomy"),
      collection: z.string().optional(),
      kind: z.string().optional(),
      hostedOnly: z.boolean().optional().describe("Only documents with a delivery URL"),
      limit: z.number().int().min(1).max(200).optional(),
      includeRecentUploads: z.boolean().optional().describe("Also include documents uploaded since the last catalog build (slower)")
    }
  },
  async ({ limit = 40, includeRecentUploads = false, ...filters }) => {
    const { documents, liveError } = await getDocuments({ live: includeRecentUploads });
    const matched = filterDocuments(documents, filters);
    return text({
      total: matched.length,
      returned: Math.min(limit, matched.length),
      liveError,
      documents: matched.slice(0, limit).map(compactDocument)
    });
  }
);

server.registerTool(
  "get_province",
  {
    title: "Get province dossier",
    description:
      "Everything the library knows about one province: document counts, industrial parks with their coverage status (layout map and/or geotechnical record), category mix and readiness score.",
    inputSchema: { province: z.string().describe("Province slug, e.g. dong-nai") }
  },
  async ({ province }) => {
    const { documents } = await getDocuments();
    const stats = buildStats(documents);
    const found = stats.provinces.find((item) => item.slug === province);
    if (!found) {
      return text({ error: `Unknown or empty province: ${province}`, hint: "Call list_taxonomy for valid slugs." });
    }
    return text({
      ...found,
      zones: found.zones.map((zone) => ({
        slug: zone.zoneSlug,
        name: zone.zoneName,
        documents: zone.documentCount,
        coverage: zone.coverage,
        categories: zone.categories
      }))
    });
  }
);

server.registerTool(
  "get_zone",
  {
    title: "Get industrial park documents",
    description: "All documents attached to one industrial park, grouped by category, with delivery URLs.",
    inputSchema: {
      zone: z.string().describe("Industrial park slug, e.g. nam-dinh-vu"),
      province: z.string().optional().describe("Province slug, needed when the same park name exists in several provinces")
    }
  },
  async ({ zone, province }) => {
    const { documents } = await getDocuments();
    const stats = buildStats(documents);
    const candidates = stats.zones.filter((item) => item.zoneSlug === zone && (!province || item.provinceSlug === province));
    if (!candidates.length) return text({ error: `No industrial park matched: ${zone}` });

    return text(
      candidates.map((item) => ({
        zone: item.zoneName,
        province: item.provinceName,
        region: item.region,
        coverage: item.coverage,
        documents: item.documents.map(compactDocument)
      }))
    );
  }
);

server.registerTool(
  "get_statistics",
  {
    title: "Get catalog statistics",
    description:
      "Aggregate statistics over the whole library or one scope: totals, per-region and per-province breakdowns, category/kind mix, per-year counts and data gaps (parks missing a layout or a geotechnical record). Includes a deterministic Vietnamese read-out.",
    inputSchema: {
      region: z.enum(["north", "central", "south"]).optional(),
      province: z.string().optional(),
      language: z.enum(["vi", "en"]).optional()
    }
  },
  async ({ region, province, language = "vi" }) => {
    const { documents } = await getDocuments();
    const scoped = filterDocuments(documents, { region, province });
    const stats = buildStats(scoped);
    return text({
      scope: { region: region ?? null, province: province ?? null },
      totals: stats.totals,
      byCategory: stats.byCategory,
      byKind: stats.byKind,
      byCollection: stats.byCollection,
      byYear: stats.byYear,
      regions: stats.regions.map(({ provinces: _provinces, ...rest }) => rest),
      topProvinces: stats.provinces.slice(0, 15).map(({ zones: _zones, ...rest }) => rest),
      gaps: stats.gaps,
      narrative: buildNarrative(stats, language)
    });
  }
);

server.registerTool(
  "classify_document",
  {
    title: "Classify a document path",
    description:
      "Run the rule-based classifier over a file name (optionally with its folder path) and get region, province, industrial park, category, media kind plus the reasons for each decision. Use before uploading so metadata stays consistent with the catalog.",
    inputSchema: {
      fileName: z.string(),
      folder: z.string().optional().describe("Folder path relative to the documentation root, '/' separated"),
      useAi: z.boolean().optional().describe("Ask Gemini to fill fields the rules could not determine (needs GEMINI_API_KEY)")
    }
  },
  async ({ fileName, folder, useAi }) => text(await classifyUpload({ fileName, folder, relPath: folder ? `${folder}/${fileName}` : fileName, useAi }))
);

server.registerTool(
  "upload_document",
  {
    title: "Upload a document",
    description:
      "Upload a local file to Cloudinary with catalog-consistent tags and context. Classification is derived from the path and can be overridden with hints. Requires MCP_ALLOW_UPLOAD=true and Cloudinary credentials.",
    inputSchema: {
      filePath: z.string().describe("Absolute path of the file to upload"),
      title: z.string().optional(),
      region: z.enum(["north", "central", "south"]).optional(),
      province: z.string().optional().describe("Province slug"),
      zoneName: z.string().optional().describe("Industrial park name, e.g. 'Thang Long II'"),
      category: z.string().optional().describe("Category id from list_taxonomy")
    }
  },
  async ({ filePath, title, region, province, zoneName, category }) => {
    if (process.env.MCP_ALLOW_UPLOAD !== "true") {
      return text({ error: "Uploads are disabled. Set MCP_ALLOW_UPLOAD=true to enable this tool." });
    }
    assertCloudinaryConfigured();
    if (!fs.existsSync(filePath)) return text({ error: `File not found: ${filePath}` });

    const fileName = path.basename(filePath);
    const buffer = await fs.promises.readFile(filePath);
    const classification = await classifyUpload({
      fileName,
      relPath: filePath.split(path.sep).join("/"),
      hints: { region, provinceSlug: province, zoneName, category }
    });

    const doc = {
      id: `mcp-${Date.now().toString(36)}`,
      fileName,
      title: title ?? fileName.replace(/\.[A-Za-z0-9]+$/, ""),
      relPath: fileName,
      sizeBytes: buffer.length,
      ...classification,
      source: "mcp"
    };

    const limit = doc.resourceType === "video" ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (buffer.length > limit) {
      return text({ error: `File is ${(buffer.length / 1048576).toFixed(1)} MB, over the ${(limit / 1048576).toFixed(0)} MB plan limit.` });
    }

    const result = await uploadBuffer({
      buffer,
      fileName,
      publicId: buildPublicId(doc),
      resourceType: doc.resourceType,
      tags: buildTags(doc),
      context: buildContext(doc)
    });

    return text({
      uploaded: true,
      publicId: result.public_id,
      url: result.secure_url,
      bytes: result.bytes,
      classification: {
        region: doc.region,
        province: doc.provinceSlug,
        zone: doc.zoneSlug,
        category: doc.category,
        reasons: doc.reasons
      }
    });
  }
);

server.registerTool(
  "cloudinary_status",
  {
    title: "Cloudinary status",
    description: "Plan usage (credits, storage, resource count) and the number of documents currently hosted under the project folder.",
    inputSchema: {}
  },
  async () => {
    assertCloudinaryConfigured();
    const [plan, hosted] = await Promise.all([usage(), liveDocuments({ force: true }).catch(() => [])]);
    return text({
      plan: plan.plan,
      credits: plan.credits,
      storageBytes: plan.storage?.usage ?? null,
      mediaLimits: plan.media_limits,
      hostedDocuments: hosted.length,
      rootFolder: process.env.CLOUDINARY_ROOT_FOLDER ?? "v-tnf"
    });
  }
);

// Resources: the raw catalog and the province geometry, for agents that want the whole picture.
server.registerResource(
  "catalog",
  "vtnf://catalog",
  { title: "Document catalog snapshot", description: "src/data/documentCatalog.json as built from the company share", mimeType: "application/json" },
  async () => ({
    contents: [
      {
        uri: "vtnf://catalog",
        mimeType: "application/json",
        text: await fs.promises.readFile(path.join(REPO_ROOT, "src", "data", "documentCatalog.json"), "utf8")
      }
    ]
  })
);

server.registerResource(
  "provinces",
  "vtnf://provinces.geojson",
  { title: "Vietnam province geometry", description: "Simplified province outlines with region and merger metadata", mimeType: "application/geo+json" },
  async () => ({
    contents: [
      {
        uri: "vtnf://provinces.geojson",
        mimeType: "application/geo+json",
        text: await fs.promises.readFile(path.join(REPO_ROOT, "src", "data", "vietnamProvinces.geo.json"), "utf8")
      }
    ]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`v-tnf-documents MCP server ready (${HERE})\n`);
