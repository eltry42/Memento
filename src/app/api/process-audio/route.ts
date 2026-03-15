import { NextResponse } from "next/server";
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
  // Slice to keep only the last 6 messages to stay within token limits
  return history
    .slice(-NUMBER_OF_MESSAGES_TO_KEEP)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const apiKey = process.env.MERALION_API_KEY;
    const currentSummary = (formData.get("summary") as string) || "";

    // Extract conversation history if sent
    const history = parseHistory(formData.get("history") as string | null);

    if (!audioFile || !apiKey) {
      return NextResponse.json(
        { error: "Missing file or API key" },
        { status: 400 },
      );
    }

    // STEP 1: Get the Presigned S3 URL, creates custom for us
    const urlResponse = await fetch("https://api.cr8lab.com/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
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

    // --- HELPER: Retry Transcription (Wait for S3 to see the file) ---
    // IMPROVEMENT TODO: can use exponential backoff -> increasing time delay between each iteration
    let userText = "";
    for (let i = 0; i < NUMBER_OF_TRANSCRIPT_RETRIES; i++) {
      console.log(
        `Attempt ${i + 1}: Checking if file is ready for transcription...`,
      );

      const transcribeRes = await fetch("https://api.cr8lab.com/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ key: s3Key }),
      });

      if (transcribeRes.ok) {
        const transcribeData = await transcribeRes.json();
        const rawText = transcribeData.response.text;
        userText = rawText.replace(/<Speaker\s?\d+>:\s?/gi, "").trim(); // remove speaker tags if any
        console.log("✅ Transcription successful:", userText);
        break;
      }
      // Wait 1 second before retrying if file not found
      if (i === 9) {
        throw new Error("Transcribing data failed");
      }
      console.log("File not found yet, waiting 1s...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const convoHistory = compileConvoHistory(history);
    // --- STEP 3: Process the AI Response ---
    const processResponse = await fetch("https://api.cr8lab.com/process", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        key: s3Key,
        instruction: `
          Role: You are Memento, a warm Singaporean AI companion for the elderly with early dementia.  
          You chat in Singlish and love to reminisce about the past, especially Singapore's history and culture. 
          You are patient, kind, and always eager to listen.
          Local context: Use warm Singlish terms like 'Uncle' or 'Auntie' naturally.
          
          LONG-TERM MEMORY (Crucial life facts):
          ${currentSummary}

          CONVERSATION LOG:
          ${convoHistory}

          LATEST USER INPUT:
          "${userText}"

          Respond warmly to the latest input while remembering the context above.
        `,
      }),
    });
    console.log("Long-term summary sent to MERaLiON:\n", currentSummary, "\n-------------------");
    console.log("Conversation history sent to MERaLiON:\n", convoHistory, "\n-------------------");
    console.log("Latest user input sent to MERaLiON:\n", userText, "\n-------------------");

    if (!processResponse.ok) throw new Error("MERaLiON processing failed");
    const processData = await processResponse.json();
    const aiText = processData.response.text;
    let updatedSummary = currentSummary;
    console.log("ASSISTANT REPLIED:", aiText);

    console.log("Number of messages in history:", history.length);

    // If we have more than 10 messages in history, we want to summarize the oldest 5 and merge into the long-term summary
    if (history.length > NUMBER_OF_MESSAGES_TO_KEEP) {
      console.log("Archiving oldest 5 messages into Long-term Memory...");
      const oldestMessages = history
        .slice(0, 5)
        .map((m) => `${m.role}: ${m.text}`)
        .join("\n");
      console.log("CONDENSING OLDEST 5 MESSAGES:\n", oldestMessages);

      try {
        const summaryResponse = await fetch("https://api.cr8lab.com/process", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({
            key: s3Key,
            instruction: `
              Merge these new details into an accumulated summary. Keep it concise.
              Make sure to preserve any important life facts about the user and their loved ones, as well as key personality traits and preferences that Memento has learned over time.
              EXISTING SUMMARY: ${currentSummary}
              NEW DETAILS TO ADD: ${oldestMessages}
            `,
          }),
        });
        const summaryData = await summaryResponse.json();
        updatedSummary = summaryData.response.text;
        console.log("Updated Summary:\n", updatedSummary, "\n-------------------");
      } catch {
        console.error("Summarization failed, keeping old summary.");
      }
    }

    return NextResponse.json({
      userText: userText,
      aiText: aiText,
      summary: updatedSummary, // send back the potentially updated summary
    });
  } catch (error) {
    console.error("Audio Processing Error:", error);
    return NextResponse.json(
      { error: "Failed to process audio" },
      { status: 500 },
    );
  }
}
