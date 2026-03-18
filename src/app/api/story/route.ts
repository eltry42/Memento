import { NextResponse } from "next/server";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

interface StoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPT = `You are a warm, friendly storyteller for elderly users with early dementia in Singapore.

RULES:
- Tell stories in simple, clear English with light Singlish flavor (lah, hor, Uncle, Auntie).
- Stories should be warm, nostalgic, and comforting — drawing from familiar Singapore themes: hawker centres, kampung life, old neighborhoods, festivals, family gatherings.
- Keep each response to 2-4 short paragraphs.
- At the end of each response, ask the user a simple choice to continue the story (e.g., "What should Uncle Ah Kow do next — go to the market or visit his old friend?").
- Give exactly 2 choices, clearly labelled as A and B.
- If the user picks a choice or says something related, continue the story naturally.
- If the user says "new story", start a fresh story with a new character and setting.
- Keep the tone gentle, never scary or sad. Stories should feel like a cozy chat.
- Never mention you are an AI. You are just a storyteller.`;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OpenAI API key" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      messages?: StoryMessage[];
    };

    const messages: StoryMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(body.messages ?? []),
    ];

    // If no user messages yet, prompt for a story start
    if (!body.messages || body.messages.length === 0) {
      messages.push({
        role: "user",
        content: "Tell me a story!",
      });
    }

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 512,
      temperature: 0.9,
    });

    const text = response.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Story API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate story" },
      { status: 500 },
    );
  }
}
