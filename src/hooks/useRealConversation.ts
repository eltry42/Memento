"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMicVAD, utils } from "@ricky0123/vad-react";
import { AvatarEvent } from "@/types/avatar";
import { ConversationMessage } from "@/types/conversation";
import { GREETING_TEXT } from "@/lib/mock-data";
import { VAD_REDEMPTION_MS } from "@/lib/constants";
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
  const greetingDone = useRef(false);
  const sessionIdRef = useRef(getOrCreateSessionId());

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
        formData.append("sessionId", sessionIdRef.current);

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
      } catch (error) {
        console.error("Server request failed", error);
        setBubbleText("I'm sorry, I couldn't process your voice right now. Please try speaking again.");
        dispatch({ type: "SPEAKING_DONE" }); // Reset the avatar
      }
    },
  });


  const addAssistantMessage = useCallback((text: string) => {
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
  }, [dispatch]);

  const handleMicPress = useCallback(() => {
    if (vad.listening) {
      vad.pause();
    } else {
      vad.start(); // start browser mic
    }
  }, [vad]);

  // Same cleanup callbacks so HomeScreen doesn't break
  const handleGreetingComplete = useCallback(() => {
    setTimeout(() => dispatch({ type: "GREETING_DONE" }), 2000);
  }, [dispatch]);

  const handleSpeakingComplete = useCallback(() => {
    setTimeout(() => dispatch({ type: "SPEAKING_DONE" }), 2000);
  }, [dispatch]);

  // Return the EXACT same shape as the mock hook
  return {
    bubbleText,
    messages,
    sessionId: sessionIdRef.current,
    handleMicPress,
    handleGreetingComplete,
    handleSpeakingComplete,
    addAssistantMessage,
  };
}
