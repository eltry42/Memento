"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicVAD, utils } from "@ricky0123/vad-web";
import { AvatarEvent } from "@/types/avatar";
import { ConversationMessage } from "@/types/conversation";
import { GREETING_TEXT } from "@/lib/mock-data";
import { VAD_REDEMPTION_MS } from "@/lib/constants";
import { getOrCreateSessionId } from "@/lib/client-session";
import { useLanguage } from "@/hooks/useLanguage";

interface UseRealConversationOptions {
  dispatch: (event: AvatarEvent) => void;
}

let messageIdCounter = 0;
function nextMessageId() {
  return `msg-${++messageIdCounter}`;
}

export function useRealConversation({ dispatch }: UseRealConversationOptions) {
  const [bubbleText, setBubbleText] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [summary, setSummary] = useState<string>("No summary yet.");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [vadListening, setVadListening] = useState(false);

  const greetingDone = useRef(false);
  const sessionIdRef = useRef(getOrCreateSessionId());
  const greetingPlaybackAttemptedRef = useRef(false);
  const completionModeRef = useRef<"audio" | "bubble">("bubble");
  const activeSpeechKindRef = useRef<"greeting" | "speaking" | null>(null);
  const playbackTokenRef = useRef(0);

  // Web Audio Management Refs
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const { language } = useLanguage();
  const vadRef = useRef<MicVAD | null>(null);
  const vadInitializingRef = useRef(false);

  // Sync refs to avoid stale closures in VAD callbacks
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const cleanupAudio = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch (e) {
        // Source might have already stopped
      }
      activeSourceRef.current = null;
    }
    setAnalyser(null);
  }, []);

  const finishAssistantSpeech = useCallback(
    (kind: "greeting" | "speaking") => {
      if (activeSpeechKindRef.current !== kind) return;
      activeSpeechKindRef.current = null;
      completionModeRef.current = "bubble";
      dispatch({ type: kind === "greeting" ? "GREETING_DONE" : "SPEAKING_DONE" });
    },
    [dispatch]
  );

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

        if (!response.ok) throw new Error("TTS fetch failed");

        const arrayBuffer = await response.arrayBuffer();

        // Initialize AudioContext on user interaction path
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = audioCtxRef.current || new AudioContext();
        audioCtxRef.current = ctx;

        if (ctx.state === "suspended") await ctx.resume();

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (playbackTokenRef.current !== token) return;

        const source = ctx.createBufferSource();
        const newAnalyser = ctx.createAnalyser();
        newAnalyser.fftSize = 128;

        source.buffer = audioBuffer;
        source.connect(newAnalyser);
        newAnalyser.connect(ctx.destination);

        activeSourceRef.current = source;
        setAnalyser(newAnalyser);
        completionModeRef.current = "audio";

        source.start(0);

        source.onended = () => {
          if (playbackTokenRef.current !== token) return;
          cleanupAudio();
          finishAssistantSpeech(kind);
        };
      } catch (error) {
        console.error("Playback failed", error);
        // Fallback to bubble-only if audio fails
        completionModeRef.current = "bubble";
        // Manual trigger for bubble timeout if no audio plays
        setTimeout(() => finishAssistantSpeech(kind), 3000);
      }
    },
    [cleanupAudio, finishAssistantSpeech, language]
  );

  const initVAD = useCallback(async () => {
    if (vadRef.current || vadInitializingRef.current) return vadRef.current;
    vadInitializingRef.current = true;

    try {
      const instance = await MicVAD.new({
        redemptionMs: VAD_REDEMPTION_MS,
        baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web/dist/",
        onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/",

        onSpeechStart: () => {
          playbackTokenRef.current += 1;
          cleanupAudio();
          setBubbleText("");
          dispatchRef.current({ type: "START_LISTENING" });
        },

        onSpeechEnd: async (audio) => {
          vadRef.current?.pause();
          setVadListening(false);
          dispatchRef.current({ type: "STOP_LISTENING" });
          dispatchRef.current({ type: "START_THINKING" });
          setBubbleText("...");

          try {
            const wavBuffer = utils.encodeWAV(audio);
            const audioBlob = new Blob([wavBuffer], { type: "audio/wav" });
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.wav");
            formData.append("sessionId", sessionIdRef.current);
            formData.append("history", JSON.stringify(messagesRef.current));
            formData.append("summary", summaryRef.current);

            const response = await fetch("/api/process-audio", {
              method: "POST",
              body: formData,
            });
            const data = await response.json();

            if (data.summary) {
              setSummary(data.summary);
              localStorage.setItem("memento_summary", data.summary);
            }

            setMessages((prev) => [
              ...prev,
              { id: nextMessageId(), role: "user", text: data.userText, timestamp: Date.now() },
              { id: nextMessageId(), role: "assistant", text: data.aiText, timestamp: Date.now() + 1 },
            ]);

            setBubbleText(data.aiText);
            dispatchRef.current({ type: "START_SPEAKING", text: data.aiText });

            playAssistantAudio(data.aiText, "speaking");
          } catch (error) {
            console.error("Process failed", error);
            setBubbleText("Aiyoh, something went wrong. Try again?");
            dispatchRef.current({ type: "SPEAKING_DONE" });
          }
        },
      });
      vadRef.current = instance;
      vadInitializingRef.current = false;
      return instance;
    } catch (e) {
      vadInitializingRef.current = false;
      throw e;
    }
  }, [cleanupAudio, playAssistantAudio]);

  useEffect(() => {
    const saved = localStorage.getItem("memento_summary");
    if (saved) setSummary(saved);

    if (greetingDone.current) return;
    greetingDone.current = true;
    setTimeout(() => {
      setBubbleText(GREETING_TEXT);
      setMessages([{ id: nextMessageId(), role: "assistant", text: GREETING_TEXT, timestamp: Date.now() }]);
      dispatch({ type: "START_GREETING" });
      activeSpeechKindRef.current = "greeting";
    }, 800);
  }, [dispatch]);

  const handleMicPress = useCallback(async () => {
    // Wake up audio context on user gesture
    if (audioCtxRef.current?.state === "suspended") {
      await audioCtxRef.current.resume();
    }

    if (!greetingPlaybackAttemptedRef.current && activeSpeechKindRef.current === "greeting") {
      greetingPlaybackAttemptedRef.current = true;
      playAssistantAudio(GREETING_TEXT, "greeting");
      return;
    }
    if (vadRef.current && vadListening) {
      vadRef.current.pause();
      setVadListening(false);
      return;
    }
    const vad = await initVAD();
    if (vad) {
      vad.start();
      setVadListening(true);
      setBubbleText("");
    }
  }, [initVAD, vadListening, playAssistantAudio]);

  // Clean up on unmount to release microphone and audio resources
  useEffect(() => {
    return () => {
      cleanupAudio();
      if (vadRef.current) {
        vadRef.current.pause();
        vadRef.current.destroy();
        vadRef.current = null;
      }
    };
  }, [cleanupAudio]);

  return {
    bubbleText,
    messages,
    handleMicPress,
    handleGreetingComplete: () => {
      // Logic for non-audio fallback
      if (completionModeRef.current === "bubble" && activeSpeechKindRef.current === "greeting") {
        setTimeout(() => finishAssistantSpeech("greeting"), 2000);
      }
    },
    handleSpeakingComplete: () => {
      // Logic for non-audio fallback
      if (completionModeRef.current === "bubble" && activeSpeechKindRef.current === "speaking") {
        setTimeout(() => finishAssistantSpeech("speaking"), 2000);
      }
    },
    analyser,
  };
}