export type SupportedLanguage = "en" | "zh" | "ta" | "ms";

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>(["en", "zh", "ta", "ms"]);

export function normalizeLanguage(input: unknown): SupportedLanguage {
  if (typeof input !== "string") return "en";

  const normalized = input.trim().toLowerCase();
  if (!normalized) return "en";

  const base = normalized.split("-")[0];
  if (SUPPORTED_LANGUAGES.has(base as SupportedLanguage)) {
    return base as SupportedLanguage;
  }

  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("ta")) return "ta";
  if (normalized.startsWith("ms") || normalized.startsWith("may")) return "ms";

  return "en";
}

export function detectLanguageFromText(
  text: string,
  fallbackLanguage: unknown = "en",
): SupportedLanguage {
  const trimmed = text.trim();
  if (!trimmed) return normalizeLanguage(fallbackLanguage);

  if (/[\u4e00-\u9fff]/u.test(trimmed)) {
    return "zh";
  }

  if (/[\u0b80-\u0bff]/u.test(trimmed)) {
    return "ta";
  }

  const lowered = trimmed.toLowerCase();
  const malaySignals = [
    "saya",
    "awak",
    "anda",
    "bukan",
    "boleh",
    "nak",
    "mahu",
    "sudah",
    "belum",
    "kenapa",
    "macam",
    "jangan",
    "tolong",
    "terima kasih",
    "selamat",
    "apa khabar",
    "makan",
    "minum",
  ];

  const malayMatchCount = malaySignals.reduce(
    (count, token) => count + (lowered.includes(token) ? 1 : 0),
    0,
  );

  if (malayMatchCount >= 2) {
    return "ms";
  }

  return normalizeLanguage(fallbackLanguage);
}

export function getLanguageInstruction(language: SupportedLanguage) {
  switch (language) {
    case "zh":
      return "Reply in Simplified Chinese. Do not switch to English unless the user explicitly asks for English.";
    case "ta":
      return "Reply in Tamil. Do not switch to English unless the user explicitly asks for English.";
    case "ms":
      return "Reply in Bahasa Melayu. Do not switch to English unless the user explicitly asks for English.";
    case "en":
    default:
      return "Reply in English.";
  }
}
