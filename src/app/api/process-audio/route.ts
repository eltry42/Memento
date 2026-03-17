import { NextResponse } from "next/server";
import { getConversationInstruction, getSummarizationInstruction } from "@/lib/prompts";
import { getGuardrailResponse } from "@/lib/conversation-guardrails";
import { generateWithGemini, isSingaporeRelatedQuestion } from "@/lib/gemini";

const NUMBER_OF_MESSAGES_TO_KEEP = 10;
const NUMBER_OF_TRANSCRIPT_RETRIES = 10;

// Helper to format history for the AI's instruction
type ConversationMessage = { role: "user" | "assistant"; text: string };

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
    const meralionApiKey = process.env.MERALION_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const currentSummary = (formData.get("summary") as string) || "";

    // Extract conversation history if sent
    const history = parseHistory(formData.get("history") as string | null);

    if (!audioFile || !meralionApiKey) {
      return NextResponse.json(
        { error: "Missing file or MERALION_API_KEY" },
        { status: 400 },
      );
    }

    // STEP 1: Get the Presigned S3 URL
    const urlResponse = await fetch("https://api.cr8lab.com/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": meralionApiKey },
      body: JSON.stringify({
        filename: "recording.wav",
        contentType: "audio/wav",
      }),
    });
    const urlData = await urlResponse.json();
    const { url: s3Url, key: s3Key } = urlData.response;

    // STEP 2: Upload to S3 using PUT
    const arrayBuffer = await audioFile.arrayBuffer();
    const uploadResponse = await fetch(s3Url, {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) throw new Error("S3 Upload Failed");

    // Transcription retry
    let userText = "";
    for (let i = 0; i < NUMBER_OF_TRANSCRIPT_RETRIES; i++) {
      console.log(
        `Attempt ${i + 1}: Checking if file is ready for transcription...`,
      );

      const transcribeRes = await fetch("https://api.cr8lab.com/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": meralionApiKey },
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

    const convoHistory = compileConvoHistory(history);
    const guardrailResponse = getGuardrailResponse(userText);
    if (guardrailResponse) {
      console.log("Guardrail triggered for input:", userText);
      return NextResponse.json({
        userText,
        aiText: guardrailResponse,
        summary: currentSummary,
      });
    }

    const conversationInstruction = getConversationInstruction(
      currentSummary,
      convoHistory,
      userText,
    );

    let meralionSupplement = "";
    if (isSingaporeRelatedQuestion(userText)) {
      const supplementResponse = await fetch("https://api.cr8lab.com/process", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": meralionApiKey },
        body: JSON.stringify({
          key: s3Key,
          instruction: `${conversationInstruction}\n\nFocus especially on Singapore-specific cultural and factual context if relevant.`,
        }),
      });

      if (supplementResponse.ok) {
        const supplementData = await supplementResponse.json();
        meralionSupplement = supplementData.response?.text?.trim() || "";
      }
    }

    let aiText = "";
    if (geminiApiKey) {
      aiText = await generateWithGemini({
        apiKey: geminiApiKey,
        instruction: conversationInstruction,
        userInput: userText,
        supplement: meralionSupplement,
      });
    } else {
      const processResponse = await fetch("https://api.cr8lab.com/process", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": meralionApiKey },
        body: JSON.stringify({
          key: s3Key,
          instruction: conversationInstruction,
        }),
      });

      if (!processResponse.ok) throw new Error("MERaLiON processing failed");
      const processData = await processResponse.json();
      aiText = processData.response.text;
    }

    if (!aiText) {
      throw new Error("No AI response generated");
    }

    let updatedSummary = currentSummary;

    try {
      const summaryResponse = await fetch("https://api.cr8lab.com/process", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": meralionApiKey },
        body: JSON.stringify({
          key: s3Key,
          instruction: getSummarizationInstruction(
            currentSummary,
            buildSummaryUpdateLog(userText, aiText),
          ),
        }),
      });
      const summaryData = await summaryResponse.json();
      updatedSummary = summaryData.response.text;
      console.log("Updated Summary:\n", updatedSummary, "\n-------------------");
    } catch {
      console.error("Summarization failed, keeping old summary.");
    }

    return NextResponse.json({
      userText,
      aiText,
      summary: updatedSummary,
    });
  } catch (error) {
    console.error("Audio Processing Error:", error);
    return NextResponse.json(
      { error: "Failed to process audio" },
      { status: 500 },
    );
  }
}
