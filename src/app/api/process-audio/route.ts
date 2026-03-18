import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getOpenAIConversationMessages,
  getMeralionRewriteInstruction,
  getSummarizationInstruction,
} from "@/lib/prompts";
import { getGuardrailResponse } from "@/lib/conversation-guardrails";
import { detectLanguageFromText, normalizeLanguage } from "@/lib/language";

const NUMBER_OF_MESSAGES_TO_KEEP = 10;
const NUMBER_OF_TRANSCRIPT_RETRIES = 10;

type ConversationMessage = { role: "user" | "assistant"; text: string };

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function parseHistory(raw: string | null): ConversationMessage[] {
  if (!raw) return [];

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
  if (!history || history.length === 0) return "No previous context.";
  return history
    .slice(-NUMBER_OF_MESSAGES_TO_KEEP)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");
}

function buildSummaryUpdateLog(userText: string, aiText: string) {
  return `user: ${userText}\nassistant: ${aiText}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const meralionKey = process.env.MERALION_API_KEY;
    const currentSummary = (formData.get("summary") as string) || "";
    const history = parseHistory(formData.get("history") as string | null);
    const preferredLanguage = normalizeLanguage(formData.get("preferredLanguage"));

    if (!audioFile || !meralionKey) {
      return NextResponse.json(
        { error: "Missing file or MERaLiON API key" },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OpenAI API key" },
        { status: 500 },
      );
    }

    // STEP 1: Get presigned S3 URL
    const urlResponse = await fetch("https://api.cr8lab.com/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": meralionKey },
      body: JSON.stringify({
        filename: "recording.wav",
        contentType: "audio/wav",
      }),
    });
    const urlData = await urlResponse.json();
    const { url: s3Url, key: s3Key } = urlData.response;

    // STEP 2: Upload audio to S3
    const arrayBuffer = await audioFile.arrayBuffer();
    const uploadResponse = await fetch(s3Url, {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) throw new Error("S3 Upload Failed");

    // STEP 3: Transcribe with MERaLiON
    let userText = "";
    for (let i = 0; i < NUMBER_OF_TRANSCRIPT_RETRIES; i++) {
      console.log(`Attempt ${i + 1}: Checking if file is ready for transcription...`);

      const transcribeRes = await fetch("https://api.cr8lab.com/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": meralionKey },
        body: JSON.stringify({ key: s3Key }),
      });

      if (transcribeRes.ok) {
        const transcribeData = await transcribeRes.json();
        const rawText = transcribeData.response.text;
        userText = rawText.replace(/<Speaker\s?\d+>:\s?/gi, "").trim();
        console.log("✅ Transcription successful:", userText);
        break;
      }

      if (i === NUMBER_OF_TRANSCRIPT_RETRIES - 1) {
        throw new Error("Transcribing data failed");
      }
      console.log("File not found yet, waiting 1s...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Guardrail check
    const convoHistory = compileConvoHistory(history);
    const detectedLanguage = detectLanguageFromText(userText, preferredLanguage);
    const guardrailResponse = getGuardrailResponse(userText);
    if (guardrailResponse) {
      console.log("Guardrail triggered for input:", userText);
      return NextResponse.json({
        userText,
        aiText: guardrailResponse,
        summary: currentSummary,
        language: detectedLanguage,
      });
    }

    // STEP 4: OpenAI generates the reasoning response
    console.log("📤 Sending to OpenAI for reasoning...");
    const openaiMessages = getOpenAIConversationMessages(
      currentSummary,
      convoHistory,
      userText,
      detectedLanguage,
    );
    const openaiResponse = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      max_tokens: 256,
      temperature: 0.7,
    });
    const openaiText = openaiResponse.choices[0]?.message?.content?.trim() || "";
    console.log("🤖 OpenAI response:", openaiText);

    // STEP 5: MERaLiON rewrite + summarization in parallel
    const [rewriteResult, summaryResult] = await Promise.allSettled([
      // MERaLiON rewrites OpenAI's response into Singlish
      fetch("https://api.cr8lab.com/process", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": meralionKey },
        body: JSON.stringify({
          key: s3Key,
          instruction: getMeralionRewriteInstruction(openaiText, detectedLanguage),
        }),
      }).then((res) => {
        if (!res.ok) throw new Error("MERaLiON rewrite failed");
        return res.json();
      }),

      // MERaLiON summarizes the conversation for long-term memory
      fetch("https://api.cr8lab.com/process", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": meralionKey },
        body: JSON.stringify({
          key: s3Key,
          instruction: getSummarizationInstruction(
            currentSummary,
            buildSummaryUpdateLog(userText, openaiText),
          ),
        }),
      }).then((res) => {
        if (!res.ok) throw new Error("MERaLiON summarization failed");
        return res.json();
      }),
    ]);

    // Use MERaLiON's rewritten text, fall back to OpenAI's plain text if rewrite fails
    let aiText = openaiText;
    if (rewriteResult.status === "fulfilled") {
      aiText = rewriteResult.value.response.text;
      console.log("🗣️ MERaLiON rewrite:", aiText);
    } else {
      console.error("MERaLiON rewrite failed, using OpenAI response directly:", rewriteResult.reason);
    }

    // Use updated summary, fall back to current if summarization fails
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
      language: detectedLanguage,
    });
  } catch (error) {
    console.error("Audio Processing Error:", error);
    return NextResponse.json(
      { error: "Failed to process audio" },
      { status: 500 },
    );
  }
}
