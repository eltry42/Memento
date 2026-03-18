import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getOpenAIConversationMessages,
  getMeralionRewriteInstruction,
  getSummarizationInstruction,
} from "@/lib/prompts";
import { getGuardrailResponse } from "@/lib/conversation-guardrails";

const NUMBER_OF_MESSAGES_TO_KEEP = 10;
const NUMBER_OF_PROCESS_RETRIES = 10;

type ConversationMessage = { role: "user" | "assistant"; text: string };

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

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

async function ensureMeralionS3Key(apiKey: string): Promise<string> {
  const uploadUrlResponse = await fetch("https://api.cr8lab.com/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      filename: "prompt-lab-silence.wav",
      contentType: "audio/wav",
    }),
  });

  if (!uploadUrlResponse.ok) {
    throw new Error(`MERaLiON upload-url failed: ${uploadUrlResponse.status}`);
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
    throw new Error(`MERaLiON S3 upload failed: ${uploadResponse.status}`);
  }

  return s3Key;
}

async function meralionProcessWithRetry({
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

    console.log(`MERaLiON process attempt ${attempt + 1} file not found, retrying...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("MERaLiON processing failed after retries");
}

export async function POST(request: Request) {
  try {
    const meralionKey = process.env.MERALION_API_KEY;
    if (!meralionKey) {
      return NextResponse.json(
        { error: "Missing MERaLiON API key" },
        { status: 500 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OpenAI API key" },
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

    // STEP 1: OpenAI reasoning + S3 key setup in parallel
    const [openaiResponse, s3Key] = await Promise.all([
      getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: getOpenAIConversationMessages(currentSummary, convoHistory, userText),
        max_tokens: 256,
        temperature: 0.7,
      }),
      ensureMeralionS3Key(meralionKey),
    ]);

    const openaiText = openaiResponse.choices[0]?.message?.content?.trim() || "";
    console.log("🤖 OpenAI response:", openaiText);

    // STEP 2: MERaLiON rewrite + summarization in parallel
    const [rewriteResult, summaryResult] = await Promise.allSettled([
      meralionProcessWithRetry({
        apiKey: meralionKey,
        key: s3Key,
        instruction: getMeralionRewriteInstruction(openaiText),
      }).then((res) => res.json()),

      meralionProcessWithRetry({
        apiKey: meralionKey,
        key: s3Key,
        instruction: getSummarizationInstruction(
          currentSummary,
          buildSummaryUpdateLog(userText, openaiText),
        ),
      }).then((res) => res.json()),
    ]);

    // Use rewritten text, fall back to OpenAI's plain text
    let aiText = openaiText;
    if (rewriteResult.status === "fulfilled") {
      aiText = rewriteResult.value.response.text;
      console.log("🗣️ MERaLiON rewrite:", aiText);
    } else {
      console.error("MERaLiON rewrite failed, using OpenAI response:", rewriteResult.reason);
    }

    let updatedSummary = currentSummary;
    if (summaryResult.status === "fulfilled") {
      updatedSummary = summaryResult.value.response.text;
      console.log("📝 Updated Summary:", updatedSummary);
    } else {
      console.error("Summarization failed, keeping old summary:", summaryResult.reason);
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
