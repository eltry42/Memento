"use client";

import { useEffect } from "react";
import MicButton from "./MicButton";
import PillButton from "@/components/ui/PillButton";
import { SessionPhase } from "@/types/session";
import { useLanguage, LANGUAGES } from "@/hooks/useLanguage";

interface BottomControlsProps {
  sessionPhase: SessionPhase;
  isMuted: boolean;
  isListening: boolean;
  onMicPress: () => void;
  micDisabled?: boolean;
  onChatLogPress?: () => void;
}

function LanguageIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function BottomControls({
  sessionPhase,
  isMuted,
  isListening,
  onMicPress,
  micDisabled,
  onChatLogPress,
}: BottomControlsProps) {
  const { language, setLanguage, t } = useLanguage();

  const cycleLanguage = () => {
    const idx = LANGUAGES.findIndex((l) => l.id === language);
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
    setLanguage(next.id);
  };

  const currentLang = LANGUAGES.find((l) => l.id === language)!;

  useEffect(() => {
    const syncTtsLanguage = async () => {
      try {
        await fetch("/api/tts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: currentLang.id }),
        });
      } catch (error) {
        console.error("Failed to sync TTS language", error);
      }
    };

    void syncTtsLanguage();
  }, [currentLang.id]);

  return (
    <div className="absolute bottom-0 left-0 right-0 safe-bottom">
      <div className="flex items-end justify-between px-5 pb-6">
        <MicButton
          sessionPhase={sessionPhase}
          isMuted={isMuted}
          isListening={isListening}
          onPress={onMicPress}
          disabled={micDisabled}
        />
        <div className="flex flex-col gap-2.5">
          <PillButton icon={<LanguageIcon />} label={currentLang.shortLabel} onClick={cycleLanguage} />
          <PillButton icon={<ChatIcon />} label={t("home.chatLog")} onClick={onChatLogPress} />
        </div>
      </div>
    </div>
  );
}
