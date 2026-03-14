import { NextResponse } from "next/server";

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

export async function POST(request: Request) {
  try {
    const { text, language } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const modelId =
      process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;

    if (!apiKey || !voiceId) {
      return NextResponse.json(
        { error: "ElevenLabs credentials not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          language_code: normalizeLanguage(language),
          output_format: DEFAULT_OUTPUT_FORMAT,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs TTS failed:", response.status, errorText);

      let errorMessage = "Failed to synthesize speech";
      try {
        const parsed = JSON.parse(errorText) as {
          detail?: { message?: string };
        };
        errorMessage = parsed.detail?.message ?? errorMessage;
      } catch {
        // Keep the generic fallback if ElevenLabs returned a non-JSON body.
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS route failed:", error);
    return NextResponse.json(
      { error: "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}

function normalizeLanguage(language: unknown): string | undefined {
  if (language === "en" || language === "zh" || language === "ta") {
    return language;
  }

  return undefined;
}
