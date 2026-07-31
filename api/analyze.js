// GET|POST /api/analyze?region=&province=&zone=&language=vi&ai=auto
// Returns catalog-derived statistics plus commentary.
//
// Numbers are always computed from the catalog (never model-generated). The commentary is
// rule-based by default; when AI_ANALYSIS_ENABLED=true (or ai=1) Gemini rewrites it into a
// short analyst note over exactly those numbers.

import { buildNarrative, buildStats, filterDocuments } from "../src/shared/catalogStats.js";
import { mergedDocuments } from "../server/catalogSource.js";
import { generateJson, geminiEnabled, geminiModel } from "../server/gemini.mjs";
import { getQuery, readJsonBody, requireMethod, sendError, sendJson } from "../server/http.js";

const INSIGHT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    bullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
    risks: { type: "array", items: { type: "string" }, maxItems: 4 },
    nextActions: { type: "array", items: { type: "string" }, maxItems: 4 }
  },
  required: ["headline", "bullets"]
};

function compactStats(stats) {
  // Keep the prompt small: only aggregates, no document lists.
  return {
    totals: stats.totals,
    byCategory: stats.byCategory,
    byKind: stats.byKind,
    byYear: stats.byYear,
    regions: stats.regions.map((region) => ({
      id: region.id,
      name: region.name.vi,
      documents: region.documentCount,
      provinces: region.provinceCount,
      zones: region.zoneCount,
      completeZones: region.completeZones,
      readiness: region.readiness
    })),
    topProvinces: stats.provinces.slice(0, 12).map((province) => ({
      name: province.name,
      region: province.region,
      documents: province.documentCount,
      zones: province.zoneCount,
      completeZones: province.completeZones,
      readiness: province.readiness
    })),
    gaps: { mapOnly: stats.gaps.mapOnly.length, geologyOnly: stats.gaps.geologyOnly.length, provincesWithoutGeology: stats.gaps.provincesWithoutGeology.length }
  };
}

export default async function handler(request, res) {
  if (!requireMethod(request, res, "GET", "POST")) return;

  const query = request.method === "POST" ? { ...getQuery(request), ...(await readJsonBody(request).catch(() => ({}))) } : getQuery(request);
  const language = query.language === "en" ? "en" : "vi";

  try {
    const { documents, liveError } = await mergedDocuments({ includeLive: query.scope !== "snapshot" });
    const scoped = filterDocuments(documents, { region: query.region, province: query.province, zone: query.zone });
    const stats = buildStats(scoped);
    const narrative = buildNarrative(stats, language);

    const wantsAi = query.ai === "1" || query.ai === "true" || (query.ai !== "0" && geminiEnabled());
    let insight = { source: "rules", headline: narrative[0] ?? "", bullets: narrative.slice(1), risks: [], nextActions: [] };

    if (wantsAi && process.env.GEMINI_API_KEY) {
      try {
        const generated = await generateJson({
          schema: INSIGHT_SCHEMA,
          systemInstruction:
            "Bạn là chuyên gia phân tích dữ liệu hạ tầng & địa kỹ thuật cho dự án V-TNF. " +
            "Chỉ được diễn giải các con số được cung cấp, không được bịa thêm số liệu. Viết ngắn, dùng tiếng Việt.",
          prompt: [
            "Dữ liệu thống kê từ hệ thống tài liệu V-TNF (JSON):",
            JSON.stringify(compactStats(stats)),
            query.region ? `Phạm vi: vùng ${query.region}` : "Phạm vi: toàn quốc",
            query.province ? `Tỉnh: ${query.province}` : "",
            "Hãy nêu nhận định chính, các gạch đầu dòng phân tích, rủi ro dữ liệu và việc cần làm tiếp."
          ]
            .filter(Boolean)
            .join("\n")
        });
        insight = { source: `gemini:${geminiModel()}`, ...generated };
      } catch (error) {
        insight.aiError = String(error.message ?? error);
      }
    }

    sendJson(res, 200, {
      scope: { region: query.region ?? null, province: query.province ?? null, zone: query.zone ?? null },
      language,
      liveError,
      stats: {
        ...stats,
        // Trim the heavy document arrays out of the response payload.
        zones: stats.zones.map(({ documents: _documents, ...zone }) => zone),
        provinces: stats.provinces.map(({ zones, ...province }) => ({ ...province, zoneKeys: zones.map((zone) => zone.key) })),
        regions: stats.regions.map(({ provinces, ...region }) => ({ ...region, provinceSlugs: provinces.map((province) => province.slug) }))
      },
      narrative,
      insight
    });
  } catch (error) {
    sendError(res, 500, String(error.message ?? error));
  }
}
