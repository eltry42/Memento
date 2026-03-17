import { NextResponse } from "next/server";

const voiceIdByLanguage: Record<string, string | undefined> = {
  en: process.env.ELEVENLABS_VOICE_ID_EN,
  zh: process.env.ELEVENLABS_VOICE_ID_ZH,
  ta: process.env.ELEVENLABS_VOICE_ID_TA,
  ms: process.env.ELEVENLABS_VOICE_ID_MS,
};

const modelIdByLanguage: Record<string, string | undefined> = {
  en: process.env.ELEVENLABS_MODEL_ID_EN,
  zh: process.env.ELEVENLABS_MODEL_ID_ZH,
  ta: process.env.ELEVENLABS_MODEL_ID_TA,
  ms: process.env.ELEVENLABS_MODEL_ID_MS,
};

let configuredLanguage = "en";

function normalizeLanguage(language: unknown) {
  const requestedLanguage =
    typeof language === "string" ? language.toLowerCase() : configuredLanguage;
  return requestedLanguage.split("-")[0];
}

function resolveVoiceAndModel(language: string) {
  const voiceId = voiceIdByLanguage[language] ?? process.env.ELEVENLABS_VOICE_ID;
  const modelId =
    modelIdByLanguage[language] ||
    process.env.ELEVENLABS_MODEL_ID ||
    "eleven_multilingual_v2";

  return { voiceId, modelId };
}

export async function GET() {
  const { voiceId, modelId } = resolveVoiceAndModel(configuredLanguage);

  return NextResponse.json({
    message: "Backend is ALIVE",
    language: configuredLanguage,
    modelId,
    voiceId,
  });
}

export async function PUT(request: Request) {
  try {
    const { language } = await request.json();
    const normalizedLanguage = normalizeLanguage(language);

    configuredLanguage = normalizedLanguage;
    const { voiceId, modelId } = resolveVoiceAndModel(normalizedLanguage);

    return NextResponse.json({
      language: normalizedLanguage,
      modelId,
      voiceId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { text, language } = await request.json();

    const normalizedLanguage = normalizeLanguage(language);
    const requestedLanguage = typeof language === "string" ? language.toLowerCase() : normalizedLanguage;

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const { voiceId, modelId } = resolveVoiceAndModel(normalizedLanguage);

    // --- LOOK AT YOUR TERMINAL FOR THESE LOGS ---
    console.log("--- ElevenLabs Request Start ---");
    console.log("Language:", requestedLanguage);
    console.log("Normalized Language:", normalizedLanguage);
    console.log("Voice ID being used:", voiceId);
    console.log("Model ID being used:", modelId);
    console.log("API Key found:", apiKey ? "Yes (starts with " + apiKey.slice(0, 4) + ")" : "No");
    console.log("--- End Log ---");

    if (!voiceId || voiceId === "undefined") {
      return NextResponse.json({ error: `Voice ID is missing for language: ${normalizedLanguage}` }, { status: 400 });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey!,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          generation_config: { is_visemes_enabled: true },
          voice_settings: { stability: 0.5, similarity_boost: 0.8 }
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      // This is what is currently catching the 404 from ElevenLabs
      console.error("ElevenLabs Rejected Request:", errText);
      return NextResponse.json({ error: errText }, { status: response.status });
    }

    const data = await response.json();
    console.log("Did we get mouth data?", !!data.alignment, "Total letters:", data.alignment?.characters?.length);
    return NextResponse.json({
      audio: data.audio_base64,
      visemes: data.alignment, 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
