import { NextResponse } from "next/server";
import {
  getConversationInstruction,
  getSummarizationInstruction,
} from "@/lib/prompts";
import { getGuardrailResponse } from "@/lib/conversation-guardrails";
import { generateWithGemini, isSingaporeRelatedQuestion } from "@/lib/gemini";

const NUMBER_OF_MESSAGES_TO_KEEP = 10;
const NUMBER_OF_PROCESS_RETRIES = 10;

type ConversationMessage = { role: "user" | "assistant"; text: string };

function createSilentWavBuffer(durationMs = 250, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const sampleCount = Math.max(1, Math.floor((durationMs / 1000) * sampleRate));
  const dataSize = sampleCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bitsPerSample, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true);

  return buffer;
}

function parseHistory(raw: unknown): ConversationMessage[] {
  if (!raw || typeof raw !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): ConversationMessage[] => {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "role" in entry &&
        "text" in entry &&
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.text === "string"
      ) {
        return [{ role: entry.role, text: entry.text }];
      }

      return [];
    });
  } catch {
    return [];
  }
}

function compileConvoHistory(history: ConversationMessage[]) {
  if (!history.length) return "No previous context.";

  return history
    .slice(-NUMBER_OF_MESSAGES_TO_KEEP)
    .map((message) =>
      `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`,
    )
    .join("\n");
}

function buildSummaryUpdateLog(userText: string, aiText: string) {
  return `user: ${userText}\nassistant: ${aiText}`;
}

async function processWithRetry({
  apiKey,
  key,
  instruction,
}: {
  apiKey: string;
  key: string;
  instruction: string;
}) {
  for (let attempt = 0; attempt < NUMBER_OF_PROCESS_RETRIES; attempt += 1) {
    const response = await fetch("https://api.cr8lab.com/process", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ key, instruction }),
    });

    if (response.ok) {
      return response;
    }

    const errorText = await response.text();
    const shouldRetry =
      response.status === 404 && errorText.includes("FILE_NOT_FOUND");

    if (!shouldRetry || attempt === NUMBER_OF_PROCESS_RETRIES - 1) {
      throw new Error(
        `MERaLiON processing failed: ${response.status} ${errorText}`,
      );
    }

    console.log(
      `Prompt lab process attempt ${attempt + 1} could not find file yet, retrying...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("MERaLiON processing failed after retries");
}

async function createMeralionS3Key(apiKey: string) {
  const uploadUrlResponse = await fetch("https://api.cr8lab.com/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      filename: "prompt-lab-silence.wav",
      contentType: "audio/wav",
    }),
  });

  if (!uploadUrlResponse.ok) {
    const errorText = await uploadUrlResponse.text();
    throw new Error(
      `MERaLiON upload-url failed: ${uploadUrlResponse.status} ${errorText}`,
    );
  }

  const uploadUrlData = (await uploadUrlResponse.json()) as {
    response?: { url?: string; key?: string };
  };
  const s3Url = uploadUrlData.response?.url;
  const s3Key = uploadUrlData.response?.key;

  if (!s3Url || !s3Key) {
    throw new Error("MERaLiON upload-url response was missing url or key");
  }

  const uploadResponse = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: createSilentWavBuffer(),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(
      `MERaLiON S3 upload failed: ${uploadResponse.status} ${errorText}`,
    );
  }

  return s3Key;
}

export async function POST(request: Request) {
  try {
    const meralionApiKey = process.env.MERALION_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!meralionApiKey && !geminiApiKey) {
      return NextResponse.json(
        { error: "Missing both GEMINI_API_KEY and MERALION_API_KEY" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      input?: string;
      history?: string;
      summary?: string;
    };

    const userText = body.input?.trim() ?? "";
    const currentSummary = body.summary?.trim() || "";
    const history = parseHistory(body.history);

    if (!userText) {
      return NextResponse.json(
        { error: "Missing input text" },
        { status: 400 },
      );
    }

    const guardrailResponse = getGuardrailResponse(userText);
    if (guardrailResponse) {
      console.log("Prompt lab guardrail triggered for input:", userText);
      return NextResponse.json({
        userText,
        aiText: guardrailResponse,
        summary: currentSummary,
      });
    }

    const convoHistory = compileConvoHistory(history);
    const conversationInstruction = getConversationInstruction(
      currentSummary,
      convoHistory,
      userText,
    );

    const needsSingaporeSupplement = isSingaporeRelatedQuestion(userText);
    const shouldCallMeralion = !geminiApiKey || needsSingaporeSupplement;

    let s3Key: string | null = null;
    if (shouldCallMeralion && meralionApiKey) {
      s3Key = await createMeralionS3Key(meralionApiKey);
    }

    let meralionSupplement = "";
    if (needsSingaporeSupplement && meralionApiKey && s3Key) {
      const meralionResponse = await processWithRetry({
        apiKey: meralionApiKey,
        key: s3Key,
        instruction: `${conversationInstruction}\n\nFocus especially on Singapore-specific cultural and factual context if relevant.`,
      });
      const meralionData = (await meralionResponse.json()) as {
        response?: { text?: string };
      };
      meralionSupplement = meralionData.response?.text?.trim() || "";
    }

    let aiText = "";

    if (geminiApiKey) {
      aiText = await generateWithGemini({
        apiKey: geminiApiKey,
        instruction: conversationInstruction,
        userInput: userText,
        supplement: meralionSupplement,
      });
    } else if (meralionApiKey && s3Key) {
      const processResponse = await processWithRetry({
        apiKey: meralionApiKey,
        key: s3Key,
        instruction: conversationInstruction,
      });
      const processData = (await processResponse.json()) as {
        response?: { text?: string };
      };
      aiText = processData.response?.text?.trim() || "";
    }

    if (!aiText) {
      throw new Error("No AI response generated");
    }

    let updatedSummary = currentSummary;

    if (meralionApiKey && s3Key) {
      try {
        const summaryResponse = await processWithRetry({
          apiKey: meralionApiKey,
          key: s3Key,
          instruction: getSummarizationInstruction(
            currentSummary,
            buildSummaryUpdateLog(userText, aiText),
          ),
        });

        const summaryData = (await summaryResponse.json()) as {
          response?: { text?: string };
        };
        updatedSummary = summaryData.response?.text || currentSummary;
      } catch {
        console.error("Prompt lab summarization failed, keeping old summary.");
      }
    }

    return NextResponse.json({
      userText,
      aiText,
      summary: updatedSummary,
    });
  } catch (error) {
    console.error("Text Prompt Processing Error:", error);
    return NextResponse.json(
      { error: "Failed to process text prompt" },
      { status: 500 },
    );
  }
}
