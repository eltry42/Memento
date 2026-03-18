"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface StoryMessage {
  role: "user" | "assistant";
  content: string;
}

export default function StoryTimePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function fetchStory(userMessages: StoryMessage[]) {
    setLoading(true);
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: userMessages }),
      });
      if (!res.ok) throw new Error("Failed to fetch story");
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.text },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Aiyoh, something went wrong lah. Try again later, okay?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleStart() {
    setStarted(true);
    setMessages([]);
    fetchStory([]);
  }

  function handleChoice(choice: string) {
    const newMessages: StoryMessage[] = [
      ...messages,
      { role: "user", content: choice },
    ];
    setMessages(newMessages);
    fetchStory(newMessages);
  }

  function handleNewStory() {
    const newMessages: StoryMessage[] = [
      ...messages,
      { role: "user", content: "Tell me a new story!" },
    ];
    setMessages(newMessages);
    fetchStory(newMessages);
  }

  // Extract choices from the latest assistant message
  function extractChoices(text: string): { a: string; b: string } | null {
    // Match patterns like "A) ...", "A. ...", "A: ..."
    const matchA = text.match(/\b[Aa][.):\s]+(.+?)(?=\b[Bb][.):\s]|$)/);
    const matchB = text.match(/\b[Bb][.):\s]+(.+)$/);
    if (matchA && matchB) {
      return {
        a: matchA[1].trim().replace(/\n[\s\S]*/, ""),
        b: matchB[1].trim().replace(/\n[\s\S]*/, ""),
      };
    }
    return null;
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const choices = lastAssistant ? extractChoices(lastAssistant.content) : null;

  return (
    <div className="h-[100dvh] flex flex-col bg-cream-50">
      {/* Header */}
      <div className="pt-24 px-5 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg
            className="w-5 h-5 text-navy"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-navy">Story Time</h1>
      </div>

      {/* Story area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 pb-4 space-y-4"
      >
        {!started && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <span className="text-6xl">📖</span>
            <div>
              <h2 className="text-2xl font-bold text-navy mb-2">
                Ready for a story?
              </h2>
              <p className="text-navy/50 text-sm max-w-xs">
                Sit back and enjoy a cozy interactive story. You get to choose
                what happens next!
              </p>
            </div>
            <button
              onClick={handleStart}
              className="px-8 py-4 rounded-2xl bg-teal-500 text-white font-bold text-lg active:scale-95 transition-all shadow-md"
            >
              Start a Story
            </button>
          </div>
        )}

        {started &&
          messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-2xl p-4 ${
                msg.role === "assistant"
                  ? "bg-white/50 shadow-sm"
                  : "bg-teal-50/60 ml-8"
              }`}
            >
              {msg.role === "assistant" && (
                <p className="text-xs font-bold text-navy/30 mb-2">
                  Storyteller
                </p>
              )}
              {msg.role === "user" && (
                <p className="text-xs font-bold text-teal-600/50 mb-2">
                  Your choice
                </p>
              )}
              <p className="text-sm text-navy leading-relaxed whitespace-pre-line">
                {msg.content}
              </p>
            </div>
          ))}

        {loading && (
          <div className="flex items-center gap-2 p-4">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-navy/30 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-navy/30 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-navy/30 animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-sm text-navy/40">
              Thinking of the next part...
            </span>
          </div>
        )}
      </div>

      {/* Choice buttons */}
      {started && !loading && (
        <div className="px-5 pb-6 safe-bottom space-y-2">
          {choices ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleChoice(choices.a)}
                className="flex-1 py-4 px-4 rounded-2xl bg-white/60 border-2 border-teal-400/30 text-sm font-semibold text-navy active:scale-95 transition-all text-left"
              >
                <span className="text-teal-500 font-bold mr-1">A.</span>{" "}
                {choices.a}
              </button>
              <button
                onClick={() => handleChoice(choices.b)}
                className="flex-1 py-4 px-4 rounded-2xl bg-white/60 border-2 border-teal-400/30 text-sm font-semibold text-navy active:scale-95 transition-all text-left"
              >
                <span className="text-teal-500 font-bold mr-1">B.</span>{" "}
                {choices.b}
              </button>
            </div>
          ) : (
            <div />
          )}
          <button
            onClick={handleNewStory}
            className="w-full py-3 rounded-xl bg-navy/5 text-sm font-semibold text-navy/40 active:scale-95 transition-all"
          >
            New Story
          </button>
        </div>
      )}
    </div>
  );
}
