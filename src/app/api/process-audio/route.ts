import { NextResponse } from "next/server";
import { extractReminders, saveConversationPair } from "@/lib/mvp-db";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const sessionId = (formData.get("sessionId") as string) || "default-session";
    const apiKey = process.env.MERALION_API_KEY;

    if (!audioFile || !apiKey) {
      return NextResponse.json(
        { error: "Missing file or API key" },
        { status: 400 },
      );
    }

    // STEP 1: Get the Presigned S3 URL [cite: 7, 39]
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

    // STEP 2: Upload to S3 using PUT [cite: 8, 76, 442]
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
    for (let i = 0; i < 10; i++) {
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
        userText = rawText.replace(/<Speaker\s?\d+>:\s?/gi, "").trim(); // REMOVE SPEAKER ALLOCATION from output WHEN TRANSCRIBING
        console.log("✅ Transcription successful:", userText);
        break;
      }
      // Wait 1 second before retrying if file not found
      if (i === 9) {
        throw new Error("Transcribing data failed");
      }
      console.log("⏳ File not found yet, waiting 1s...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // --- STEP 3: Process the AI Response ---
    const processResponse = await fetch("https://api.cr8lab.com/process", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        key: s3Key,
        instruction:
          "You are a warm companion for an elderly user in Singapore. Reply to their audio input.",
      }),
    });

    if (!processResponse.ok) throw new Error("MERaLiON processing failed");
    const processData = await processResponse.json();
    const aiText = processData.response.text
    console.log("🤖 ASSISTANT REPLIED:", aiText);


    // Return both the user's transcript and the AI's reply
    saveConversationPair({ sessionId, userText, aiText });
    const reminders = extractReminders({ sessionId, sourceText: userText });

    return NextResponse.json({
      userText: userText,
      aiText: aiText,
      reminders,
    });
  } catch (error) {
    console.error("Audio Processing Error:", error);
    return NextResponse.json(
      { error: "Failed to process audio" },
      { status: 500 },
    );
  }
}
