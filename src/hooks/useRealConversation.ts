"use client";
// Note: stores conversation state in user's browser
// Data is lost on refresh, but allows for faster interactions without waiting for backend response every time

import { useCallback, useEffect, useRef, useState } from "react";
import { useMicVAD, utils } from "@ricky0123/vad-react";
import { AvatarEvent } from "@/types/avatar";
import { ConversationMessage } from "@/types/conversation";
import { GREETING_TEXT } from "@/lib/mock-data";
import { VAD_REDEMPTION_MS } from "@/lib/constants";
import { useLanguage } from "@/hooks/useLanguage";
import { getOrCreateSessionId } from "@/lib/client-session";

interface UseRealConversationOptions {
  dispatch: (event: AvatarEvent) => void; // sends action command
}

let messageIdCounter = 0;
function nextMessageId() {
  return `msg-${++messageIdCounter}`;
}

export function useRealConversation({ dispatch }: UseRealConversationOptions) {
  const [bubbleText, setBubbleText] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [summary, setSummary] = useState<string>("No summary yet.");
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const greetingDone = useRef(false);
  const greetingPlaybackAttemptedRef = useRef(false);
  const completionModeRef = useRef<"audio" | "bubble">("bubble");
  const activeSpeechKindRef = useRef<"greeting" | "speaking" | null>(null);
  const playbackTokenRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const { language } = useLanguage();

  const finishAssistantSpeech = useCallback(
    (kind: "greeting" | "speaking") => {
      if (activeSpeechKindRef.current !== kind) return;

      activeSpeechKindRef.current = null;
      completionModeRef.current = "bubble";

      if (kind === "greeting") {
        dispatch({ type: "GREETING_DONE" });
        return;
      }

      dispatch({ type: "SPEAKING_DONE" });
    },
    [dispatch],
  );

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const playAssistantAudio = useCallback(
    async (text: string, kind: "greeting" | "speaking") => {
      activeSpeechKindRef.current = kind;
      completionModeRef.current = "bubble";

      const token = ++playbackTokenRef.current;

      try {
        cleanupAudio();

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language }),
        });

        if (!response.ok) {
          let errorMessage = `TTS request failed: ${response.status}`;
          try {
            const data = (await response.json()) as { error?: string };
            errorMessage = data.error ?? errorMessage;
          } catch {
            // Fall back to the status-based message if JSON parsing fails.
          }
          throw new Error(errorMessage);
        }

        const audioBlob = await response.blob();
        if (!audioBlob.size) {
          throw new Error("TTS response was empty");
        }

        if (playbackTokenRef.current !== token) return;

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audioUrlRef.current = audioUrl;
        audioRef.current = audio;
        completionModeRef.current = "audio";

        audio.onended = () => {
          if (playbackTokenRef.current !== token) return;
          cleanupAudio();
          finishAssistantSpeech(kind);
        };

        audio.onerror = () => {
          if (playbackTokenRef.current !== token) return;
          cleanupAudio();
          completionModeRef.current = "bubble";
        };

        await audio.play();
      } catch (error) {
        console.error("Audio playback failed", error);
        if (playbackTokenRef.current === token) {
          cleanupAudio();
          completionModeRef.current = "bubble";
        }
      }
    },
    [cleanupAudio, finishAssistantSpeech, language],
  );

  // Load summary from LocalStorage on mount
  useEffect(() => {
    const savedSummary = localStorage.getItem("memento_summary");
    if (savedSummary) setSummary(savedSummary);
  }, []);

  // Greeting logic
  useEffect(() => {
    if (greetingDone.current) return;

    greetingDone.current = true;
    const timer = setTimeout(() => {
      setBubbleText(GREETING_TEXT);
      setMessages([
        {
          id: nextMessageId(),
          role: "assistant",
          text: GREETING_TEXT,
          timestamp: Date.now(),
        },
      ]);
      activeSpeechKindRef.current = "greeting";
      completionModeRef.current = "bubble";
      dispatch({ type: "START_GREETING" });
    }, 800); // 800 ms

    return () => clearTimeout(timer);
  }, [dispatch]);

  const addAssistantMessage = useCallback(
    (text: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "assistant",
          text,
          timestamp: Date.now(),
        },
      ]);
      setBubbleText(text);
      dispatch({ type: "START_SPEAKING", text });
    },
    [dispatch],
  );

  const vad = useMicVAD({
    startOnLoad: false,
    redemptionMs: VAD_REDEMPTION_MS,

    baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web/dist/",
    onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/",

    onSpeechStart: () => {
      playbackTokenRef.current += 1;
      cleanupAudio();
      completionModeRef.current = "bubble";
      activeSpeechKindRef.current = null;

      setBubbleText("");
      dispatch({ type: "START_LISTENING" });
    },

    onSpeechEnd: async (audio) => {
      console.log("[VAD] Speech ended! Starting processing...");
      vad.pause();
      dispatch({ type: "STOP_LISTENING" });
      dispatch({ type: "START_THINKING" });
      setBubbleText("...");

      try {
        const wavBuffer = utils.encodeWAV(audio);
        const audioBlob = new Blob([wavBuffer], { type: "audio/wav" });

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.wav");
        formData.append("history", JSON.stringify(messages));
        formData.append("summary", summary);

        console.log(
          "Sending audio, previous convo history, and summary to backend for processing...",
        );

        const response = await fetch("/api/process-audio", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        const userTranscript = data.userText;
        const aiReply = data.aiText;

        if (data.summary) {
          setSummary(data.summary);
          localStorage.setItem("memento_summary", data.summary);
          console.log(
            "Updated summary received from backend:\n",
            data.summary,
            "\n-------------------",
          );
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "user",
            text: userTranscript,
            timestamp: Date.now(),
          },
          {
            id: nextMessageId(),
            role: "assistant",
            text: aiReply,
            timestamp: Date.now() + 1,
          },
        ]);

        setBubbleText(aiReply);

        dispatch({ type: "START_SPEAKING", text: aiReply });
        void playAssistantAudio(aiReply, "speaking");
      } catch (error) {
        console.error("Server request failed", error);
        setBubbleText(
          "I'm sorry, I couldn't process your voice right now. Please try speaking again.",
        );
        dispatch({ type: "SPEAKING_DONE" });
      }
    },
  });

  const handleMicPress = useCallback(() => {
    if (
      !greetingPlaybackAttemptedRef.current &&
      activeSpeechKindRef.current === "greeting" &&
      bubbleText === GREETING_TEXT
    ) {
      greetingPlaybackAttemptedRef.current = true;
      void playAssistantAudio(GREETING_TEXT, "greeting");
      return;
    }

    if (vad.listening) {
      vad.pause();
    } else {
      vad.start();
    }
  }, [bubbleText, playAssistantAudio, vad]);

  const handleGreetingComplete = useCallback(() => {
    if (
      completionModeRef.current === "bubble" &&
      activeSpeechKindRef.current === "greeting"
    ) {
      setTimeout(() => {
        if (
          completionModeRef.current === "bubble" &&
          activeSpeechKindRef.current === "greeting"
        ) {
          finishAssistantSpeech("greeting");
        }
      }, 2000);
    }
  }, [finishAssistantSpeech]);

  const handleSpeakingComplete = useCallback(() => {
    if (
      completionModeRef.current === "bubble" &&
      activeSpeechKindRef.current === "speaking"
    ) {
      setTimeout(() => {
        if (
          completionModeRef.current === "bubble" &&
          activeSpeechKindRef.current === "speaking"
        ) {
          finishAssistantSpeech("speaking");
        }
      }, 2000);
    }
  }, [finishAssistantSpeech]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    bubbleText,
    messages,
    sessionId,
    handleMicPress,
    handleGreetingComplete,
    handleSpeakingComplete,
    addAssistantMessage,
  };
}
