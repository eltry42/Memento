"use client";

import { useState } from "react";
import AvatarComposite from "@/components/avatar/AvatarComposite";
import ChatBubbleOverlay from "./ChatBubbleOverlay";
import BottomControls from "./BottomControls";
import ChatLog from "./ChatLog";
import { useAvatarState } from "@/hooks/useAvatarState";
import { useRealConversation } from "@/hooks/useRealConversation";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";

export default function HomeScreen() {
  const { state, dispatch } = useAvatarState();
  const [isChatLogOpen, setIsChatLogOpen] = useState(false);

  const {
    bubbleText,
    messages,
    handleMicPress,
    handleGreetingComplete,
    handleSpeakingComplete,
  } = useRealConversation({ dispatch });

  const micDisabled = state !== "idle" && state !== "greeting";

  const onSpeakingComplete = () => {
    if (state === "greeting") {
      handleGreetingComplete();
    } else {
      handleSpeakingComplete();
    }
  };

  return (
    <AvatarComposite state={state}>
      <ChatBubbleOverlay
        state={state}
        text={bubbleText}
        onSpeakingComplete={onSpeakingComplete}
      />
      <BottomControls
        sessionPhase="idle"
        isMuted={false}
        isListening={state === "listening"}
        onMicPress={handleMicPress}
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
