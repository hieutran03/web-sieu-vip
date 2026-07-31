// Classification used by /api/classify, /api/admin/upload-signature and the MCP server.
// Rules first (always). Gemini only fills the fields the rules could not determine, and only
// when AI_ANALYSIS_ENABLED=true — so behaviour is identical with the key absent.

import { CATEGORIES, classifyDocument, mediaKindOf, extensionOf } from "../src/shared/classify.js";
import { PROVINCES, REGIONS } from "../src/shared/provinceMeta.js";
import { slugify } from "../src/shared/text.js";
import { generateJson, geminiEnabled } from "./gemini.mjs";

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    region: { type: "string", enum: [...REGIONS.map((region) => region.id), "unknown"] },
    provinceSlug: { type: "string", enum: [...PROVINCES.map((province) => province.slug), "unknown"] },
    zoneName: { type: "string" },
    category: { type: "string", enum: CATEGORIES.map((category) => category.id) },
    confidence: { type: "number" },
    rationale: { type: "string" }
  },
  required: ["region", "provinceSlug", "category", "confidence", "rationale"]
};

const SYSTEM_INSTRUCTION = [
  "Bạn là trợ lý phân loại tài liệu kỹ thuật cho dự án V-TNF (gia cố nền đất yếu tại Việt Nam).",
  "Nhiệm vụ: từ đường dẫn/tên tệp, xác định vùng (north/central/south), tỉnh (theo danh mục 63 tỉnh trước 2025),",
  "tên khu công nghiệp nếu có, và nhóm tài liệu. Nếu không đủ căn cứ, trả về 'unknown' thay vì phỏng đoán."
].join(" ");

function resourceTypeOf(kind) {
  if (kind === "image" || kind === "pdf") return "image";
  if (kind === "video") return "video";
  return "raw";
}

/**
 * @param {{fileName: string, relPath?: string, folder?: string, hints?: object, useAi?: boolean}} input
 */
export async function classifyUpload(input) {
  const fileName = input.fileName;
  const folderPath = input.folder ?? (input.relPath ? input.relPath.split("/").slice(0, -1).join("/") : "");
  const segments = folderPath ? folderPath.split("/").filter(Boolean) : [];

  const base = classifyDocument(segments, fileName);
  const hints = input.hints ?? {};

  // Explicit choices from the admin form always win over both rules and the model.
  const merged = {
    ...base,
    region: hints.region ?? base.region,
    provinceSlug: hints.provinceSlug ?? base.provinceSlug,
    provinceName: hints.provinceSlug ? PROVINCES.find((p) => p.slug === hints.provinceSlug)?.name ?? null : base.provinceName,
    zoneName: hints.zoneName ?? base.zoneName,
    zoneSlug: hints.zoneName ? slugify(hints.zoneName) : base.zoneSlug,
    category: hints.category ?? base.category,
    collection: hints.collection ?? base.collection,
    classifiedBy: "rules",
    aiSuggestion: null
  };

  // An explicit province implies its region; an explicit zone implies a zone collection.
  if (hints.provinceSlug && !hints.region) {
    merged.region = PROVINCES.find((province) => province.slug === hints.provinceSlug)?.region ?? merged.region;
  }
  if (hints.zoneName && !hints.collection) {
    merged.collection = merged.category === "geology" ? "zone-geology" : "industrial-zones";
  }

  const needsAi = !merged.region || !merged.provinceSlug || (!merged.zoneName && merged.collection === "industrial-zones");
  const useAi = input.useAi ?? geminiEnabled();

  if (needsAi && useAi) {
    try {
      const suggestion = await generateJson({
        systemInstruction: SYSTEM_INSTRUCTION,
        schema: CLASSIFY_SCHEMA,
        prompt: [
          `Đường dẫn: ${input.relPath ?? folderPath}`,
          `Tên tệp: ${fileName}`,
          `Kết quả theo luật: region=${merged.region ?? "unknown"}, province=${merged.provinceSlug ?? "unknown"}, zone=${merged.zoneName ?? "unknown"}, category=${merged.category}`,
          "Hãy bổ sung các trường còn thiếu."
        ].join("\n")
      });

      merged.aiSuggestion = suggestion;
      if (!merged.region && suggestion.region && suggestion.region !== "unknown") merged.region = suggestion.region;
      if (!merged.provinceSlug && suggestion.provinceSlug && suggestion.provinceSlug !== "unknown") {
        merged.provinceSlug = suggestion.provinceSlug;
        merged.provinceName = PROVINCES.find((province) => province.slug === suggestion.provinceSlug)?.name ?? null;
        if (!merged.region) merged.region = PROVINCES.find((province) => province.slug === suggestion.provinceSlug)?.region ?? null;
      }
      if (!merged.zoneName && suggestion.zoneName) {
        merged.zoneName = suggestion.zoneName;
        merged.zoneSlug = slugify(suggestion.zoneName);
      }
      merged.classifiedBy = "rules+gemini";
      merged.reasons = [...merged.reasons, `Gemini: ${suggestion.rationale} (confidence ${suggestion.confidence})`];
    } catch (error) {
      merged.reasons = [...merged.reasons, `Gemini không phản hồi: ${error.message}`];
    }
  }

  if (hints.region) merged.reasons = [...merged.reasons, "region do admin chọn"];
  if (hints.provinceSlug) merged.reasons = [...merged.reasons, "tỉnh do admin chọn"];
  if (hints.zoneName) merged.reasons = [...merged.reasons, "KCN do admin nhập"];

  const kind = mediaKindOf(fileName);
  return {
    ...merged,
    kind,
    extension: extensionOf(fileName),
    resourceType: resourceTypeOf(kind),
    aiAvailable: geminiEnabled()
  };
}
