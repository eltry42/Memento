"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AvatarComposite from "@/components/avatar/AvatarComposite";
import ChatBubbleOverlay from "./ChatBubbleOverlay";
import BottomControls from "./BottomControls";
import ChatLog from "./ChatLog";
import { useAvatarState } from "@/hooks/useAvatarState";
import { useRealConversation } from "@/hooks/useRealConversation";
import { useIdleSuggestion, Suggestion } from "@/hooks/useIdleSuggestion";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";

export default function HomeScreen() {
  const router = useRouter();
  const { state, dispatch } = useAvatarState();
  const [isChatLogOpen, setIsChatLogOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);

  const {
    bubbleText,
    messages,
    handleMicPress,
    handleGreetingComplete,
    handleSpeakingComplete,
    currentViseme
  } = useRealConversation({ dispatch });

  const { suggestion, dismissSuggestion, resetTimer } = useIdleSuggestion(state);

  // When a suggestion arrives and avatar is idle, trigger it
  useEffect(() => {
    if (suggestion && state === "idle") {
      setActiveSuggestion(suggestion);
      dispatch({ type: "START_SPEAKING", text: suggestion.text });
    }
  }, [suggestion, state, dispatch]);

  const handleSuggestionAction = useCallback((href: string) => {
    setActiveSuggestion(null);
    dismissSuggestion();
    dispatch({ type: "SPEAKING_DONE" });
    if (href) {
      router.push(href);
    }
  }, [dismissSuggestion, dispatch, router]);

  const handleDismissSuggestion = useCallback(() => {
    setActiveSuggestion(null);
    dismissSuggestion();
    dispatch({ type: "SPEAKING_DONE" });
  }, [dismissSuggestion, dispatch]);

  const wrappedMicPress = useCallback(() => {
    // Reset idle timer on mic interaction
    if (activeSuggestion) {
      handleDismissSuggestion();
    }
    resetTimer();
    handleMicPress();
  }, [activeSuggestion, handleDismissSuggestion, resetTimer, handleMicPress]);

  const micDisabled =
    state !== "idle" &&
    state !== "greeting" &&
    state !== "listening" &&
    !activeSuggestion;

  const onSpeakingComplete = () => {
    // If this was a suggestion, don't auto-dismiss — wait for button press
    if (activeSuggestion) return;

    if (state === "greeting") {
      handleGreetingComplete();
    } else {
      handleSpeakingComplete();
    }
  };

  return (
    <AvatarComposite state={state} currentViseme={currentViseme}>
      <ChatBubbleOverlay
        state={state}
        text={bubbleText}
        onSpeakingComplete={onSpeakingComplete}
      />

      {/* Suggestion action buttons */}
      {activeSuggestion && state === "speaking" && (
        <div className="absolute inset-x-4 top-[28%] flex justify-center z-20">
          <div className="flex gap-3">
            {activeSuggestion.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionAction(action.href)}
                className="px-5 py-3 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg text-sm font-bold text-navy active:scale-95 transition-all border border-teal-400/30"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {activeSuggestion && state === "speaking" && (
        <div className="absolute inset-x-4 top-[36%] flex justify-center z-20">
          <button
            onClick={handleDismissSuggestion}
            className="text-xs font-semibold text-white/50 active:scale-95 transition-all"
          >
            Maybe later
          </button>
        </div>
      )}

      <BottomControls
        sessionPhase="idle"
        isMuted={false}
        isListening={state === "listening"}
        onMicPress={wrappedMicPress}
        micDisabled={micDisabled}
        onChatLogPress={() => setIsChatLogOpen(true)}
      />
      <ChatLog
        isOpen={isChatLogOpen}
        messages={messages}
        onClose={() => setIsChatLogOpen(false)}
      />
      <OnboardingOverlay />
    </AvatarComposite>
  );
}
