// Capability probe: lets the client hide admin/AI affordances that are not configured.

import { adminAuthConfigured } from "../server/auth.mjs";
import { requireMethod, sendJson } from "../server/http.js";

export default async function handler(request, res) {
  if (!requireMethod(request, res, "GET")) return;

  sendJson(res, 200, {
    ok: true,
    time: new Date().toISOString(),
    cloudinary: {
      configured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
      rootFolder: process.env.CLOUDINARY_ROOT_FOLDER ?? "v-tnf"
    },
    admin: { configured: adminAuthConfigured() },
    ai: {
      // Gemini stays off until AI_ANALYSIS_ENABLED is flipped on: analysis is rule-based by default.
      enabled: process.env.AI_ANALYSIS_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY),
      keyPresent: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    }
  });
}
