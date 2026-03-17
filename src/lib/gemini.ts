const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";

  const first = candidates[0] as {
    content?: { parts?: Array<{ text?: string }> };
  };

  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

export function isSingaporeRelatedQuestion(text: string): boolean {
  return /(singapore|sg\b|hdb|cpf|mrt|hawker|merlion|singlish|ntu|nus|changi|orchard|jurong|toa payoh|woodlands|bishan|ang mo kio|mysejahtera)/i.test(
    text,
  );
}

export async function generateWithGemini({
  apiKey,
  instruction,
  userInput,
  supplement,
}: {
  apiKey: string;
  instruction: string;
  userInput: string;
  supplement?: string;
}) {
  const systemInstruction = [
    instruction,
    "You are the PRIMARY assistant speaking to the user.",
    "If extra context is provided, treat it as supplemental evidence and integrate it naturally.",
    "Do not mention backend models, tools, or internal routing.",
  ].join("\n\n");

  const supplementBlock = supplement
    ? `\n\nSUPPLEMENTAL SINGAPORE CONTEXT (from secondary model):\n${supplement}`
    : "";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `User message:\n${userInput}${supplementBlock}`,
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errText}`);
  }

  const payload = (await response.json()) as unknown;
  const text = extractGeminiText(payload);

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}
