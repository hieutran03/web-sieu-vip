// Gemini REST client (no SDK). Only used when AI_ANALYSIS_ENABLED=true; every feature that
// calls it has a deterministic fallback, so the app works with the key absent or disabled.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiEnabled() {
  return process.env.AI_ANALYSIS_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
}

export function geminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/**
 * Ask Gemini for structured JSON.
 * @param {{prompt: string, schema?: object, systemInstruction?: string, temperature?: number, timeoutMs?: number}} options
 */
export async function generateJson({ prompt, schema, systemInstruction, temperature = 0.2, timeoutMs = 20000 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${ENDPOINT}/${geminiModel()}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
          ...(schema ? { responseSchema: schema } : {})
        }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `Gemini request failed (${response.status})`);
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("Gemini returned an empty response");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}
