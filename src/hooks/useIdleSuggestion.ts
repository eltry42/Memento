"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface Suggestion {
  text: string;
  actions: {
    label: string;
    href: string;
  }[];
}

const SUGGESTIONS: Suggestion[] = [
  {
    text: "Aiyoh, a bit quiet lah! Want to play a memory game or hear a nice story?",
    actions: [
      { label: "Memory Game", href: "/wellness/memory-game" },
      { label: "Story Time", href: "/wellness/story-time" },
    ],
  },
  {
    text: "Eh, how about we do something fun? I can tell you a story, or we can play a game!",
    actions: [
      { label: "Tell me a story", href: "/wellness/story-time" },
      { label: "Let's play!", href: "/wellness/memory-game" },
    ],
  },
  {
    text: "You been resting ah? Want to check how you feeling today, or play a quick game?",
    actions: [
      { label: "Check my mood", href: "/wellness" },
      { label: "Play a game", href: "/wellness/memory-game" },
    ],
  },
  {
    text: "Wah, so peaceful. Shall I tell you a nice story about the old days?",
    actions: [
      { label: "Yes please!", href: "/wellness/story-time" },
      { label: "Maybe later", href: "" },
    ],
  },
];

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function useIdleSuggestion(avatarState: string) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);
  const isActiveRef = useRef(false);

  const scheduleSuggestion = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      // Only suggest when avatar is idle
      if (isActiveRef.current) return;

      const s = SUGGESTIONS[indexRef.current % SUGGESTIONS.length];
      indexRef.current += 1;
      setSuggestion(s);
    }, INTERVAL_MS);
  }, []);

  // Track whether avatar is busy
  useEffect(() => {
    isActiveRef.current = avatarState !== "idle";
  }, [avatarState]);

  // Start/restart timer on mount and when suggestion is dismissed
  useEffect(() => {
    scheduleSuggestion();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleSuggestion]);

  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
    // Restart timer for next suggestion
    scheduleSuggestion();
  }, [scheduleSuggestion]);

  const resetTimer = useCallback(() => {
    // Call this on user interaction to reset the idle timer
    setSuggestion(null);
    scheduleSuggestion();
  }, [scheduleSuggestion]);

  return { suggestion, dismissSuggestion, resetTimer };
}
