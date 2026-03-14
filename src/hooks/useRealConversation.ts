"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMicVAD, utils } from "@ricky0123/vad-react";
import { AvatarEvent } from "@/types/avatar";
import { ConversationMessage } from "@/types/conversation";
import { GREETING_TEXT } from "@/lib/mock-data";
import { VAD_REDEMPTION_MS } from "@/lib/constants";
import { useLanguage } from "@/hooks/useLanguage";

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
    [dispatch]
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
    [cleanupAudio, finishAssistantSpeech, language]
  );

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

  const vad = useMicVAD({
    startOnLoad: false,
    redemptionMs: VAD_REDEMPTION_MS, // waiting time when user not speaking before cutting off mic

    baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web/dist/",
    onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/",

    onSpeechStart: () => {
      playbackTokenRef.current += 1;
      cleanupAudio();
      completionModeRef.current = "bubble";
      activeSpeechKindRef.current = null;

      // When user start talking, clear the output bubble and show listening state
      setBubbleText("");
      dispatch({ type: "START_LISTENING" });
    },

    onSpeechEnd: async (audio) => {
      vad.pause(); // pause microphone
      // User stopped talking
      dispatch({ type: "STOP_LISTENING" });
      dispatch({ type: "START_THINKING" });
      setBubbleText("...");

      try {
        // Convert raw Float32Array audio into a WAV Blob
        const wavBuffer = utils.encodeWAV(audio);
        const audioBlob = new Blob([wavBuffer], { type: "audio/wav" });

        // Package the Blob into FormData so we can send it over HTTP
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.wav");

        console.log("Sending audio to backend...");

        // Send the POST request to your Next.js backend
        const response = await fetch("/api/process-audio", { // link to process-audio/route.ts
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        // extract specific fields
        const userTranscript = data.userText; 
        const aiReply = data.aiText;      

        // Update chat log and UI
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

        // stop thinking and start speaking real text
        dispatch({ type: "START_SPEAKING", text: aiReply});
        void playAssistantAudio(aiReply, "speaking");
      } catch (error) {
        console.error("Server request failed", error);
        setBubbleText("I'm sorry, I couldn't process your voice right now. Please try speaking again.");
        dispatch({ type: "SPEAKING_DONE" }); // Reset the avatar
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
      vad.start(); // start browser mic
    }
  }, [bubbleText, playAssistantAudio, vad]);

  // Same cleanup callbacks so HomeScreen doesn't break
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

  // Return the EXACT same shape as the mock hook
  return {
    bubbleText,
    messages,
    handleMicPress,
    handleGreetingComplete,
    handleSpeakingComplete,
  };
}
