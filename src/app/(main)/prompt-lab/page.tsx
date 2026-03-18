"use client";

import { FormEvent, useMemo, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { ConversationMessage } from "@/types/conversation";

let messageIdCounter = 0;

function nextMessageId() {
  messageIdCounter += 1;
  return `prompt-lab-${messageIdCounter}`;
}

function MessageCard({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] rounded-3xl px-4 py-3 shadow-sm"
        style={
          isUser
            ? {
                background:
                  "linear-gradient(135deg, rgba(91, 158, 166, 0.22), rgba(245, 166, 184, 0.22))",
                border: "1px solid rgba(255, 255, 255, 0.35)",
              }
            : {
                background: "rgba(255, 255, 255, 0.72)",
                border: "1px solid rgba(255, 255, 255, 0.55)",
              }
        }
      >
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-navy/45">
          {isUser ? "You" : "Memento"}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy">
          {message.text}
        </p>
      </div>
    </div>
  );
}

export default function PromptLabPage() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [summary, setSummary] = useState("No summary yet.");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const historyJson = useMemo(() => JSON.stringify(messages), [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    const userMessage: ConversationMessage = {
      id: nextMessageId(),
      role: "user",
      text: trimmedInput,
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    try {
      const response = await fetch("/api/process-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: trimmedInput,
          history: historyJson,
          summary,
          preferredLanguage: language,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        aiText?: string;
        summary?: string;
      };

      if (!response.ok || !data.aiText) {
        throw new Error(data.error || "Prompt test failed");
      }

      const assistantMessage: ConversationMessage = {
        id: nextMessageId(),
        role: "assistant",
        text: data.aiText,
        timestamp: Date.now() + 1,
      };

      setMessages((current) => [...current, assistantMessage]);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Prompt test failed";
      setError(message);
      setMessages(messages);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setSummary("No summary yet.");
    setInput("");
    setError("");
  }

  return (
    <main className="h-[calc(100dvh-5rem)] overflow-y-auto px-4 pb-8 pt-5">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <section
          className="rounded-[28px] p-5 shadow-sm"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.82), rgba(250, 219, 227, 0.62))",
            border: "1px solid rgba(255,255,255,0.7)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-teal">
                Prompt Lab
              </p>
              <h1 className="mt-2 text-2xl font-extrabold text-navy">
                Test Prompting Through Text
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy/65">
                Type a message and run it through the same conversation prompt
                and memory flow, without audio, transcription, or TTS.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full px-4 py-2 text-sm font-bold text-navy transition active:scale-95"
              style={{ background: "rgba(44, 62, 80, 0.08)" }}
            >
              Reset Session
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div
            className="flex min-h-[30rem] flex-col rounded-[28px] p-4 shadow-sm"
            style={{
              background: "rgba(255, 255, 255, 0.72)",
              border: "1px solid rgba(255,255,255,0.7)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy">Conversation</h2>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-navy/45">
                {messages.length} messages
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-navy/10 bg-cream-50/70 p-6 text-center text-sm text-navy/45">
                  Start with a typed message to test the prompt behavior.
                </div>
              ) : (
                messages.map((message) => (
                  <MessageCard key={message.id} message={message} />
                ))
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type a user message to test the prompt..."
                className="min-h-28 w-full resize-y rounded-[24px] border border-navy/10 bg-cream-50/70 px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/35 focus:border-teal/40 focus:ring-2 focus:ring-teal/20"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-navy/45">
                  Summary and history are carried between turns so you can test
                  multi-turn behavior.
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting || !input.trim()}
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-teal), var(--color-navy))",
                  }}
                >
                  {isSubmitting ? "Testing..." : "Send"}
                </button>
              </div>
              {error ? (
                <p className="text-sm font-medium text-rose-700">{error}</p>
              ) : null}
            </form>
          </div>

          <div className="space-y-4">
            <section
              className="rounded-[28px] p-4 shadow-sm"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(168, 213, 218, 0.28))",
                border: "1px solid rgba(255,255,255,0.72)",
              }}
            >
              <h2 className="text-lg font-bold text-navy">Live Summary</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-navy/75">
                {summary}
              </p>
            </section>

            <section
              className="rounded-[28px] p-4 shadow-sm"
              style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(255,255,255,0.72)",
              }}
            >
              <h2 className="text-lg font-bold text-navy">How To Use It</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-navy/70">
                <li>Try the same user input before and after a prompt change.</li>
                <li>Test vague questions, emotional responses, and memory recall.</li>
                <li>Use Reset Session when you want a clean prompt comparison.</li>
              </ul>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
