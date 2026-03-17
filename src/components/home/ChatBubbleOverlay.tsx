"use client";

import SpeechBubble from "@/components/ui/SpeechBubble";
import { AvatarState } from "@/types/avatar";
import { useLanguage } from "@/hooks/useLanguage";

interface ChatBubbleOverlayProps {
  state: AvatarState;
  text: string;
  onSpeakingComplete?: () => void;
}

function ThinkingDots() {
  return (
    <div className="animate-[bubble-appear_0.4s_ease-out_forwards]">
      <div className="glass-heavy rounded-2xl px-6 py-4 shadow-lg inline-block">
        <div className="flex gap-1.5 items-center justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 bg-navy/50 rounded-full animate-[thinking-dots_1.4s_infinite_ease-in-out]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ListeningBubble() {
  const { t } = useLanguage();
  return (
    <div className="animate-[bubble-appear_0.4s_ease-out_forwards]">
      <div className="glass-heavy rounded-2xl px-5 py-4 shadow-lg inline-block">
        <p className="text-base leading-relaxed text-navy/60 font-medium">
          {t("home.listening")}
        </p>
      </div>
    </div>
  );
}

export default function ChatBubbleOverlay({
  state,
  text,
  onSpeakingComplete,
}: ChatBubbleOverlayProps) {
  const showBubble = state === "greeting" || state === "speaking";
  const showThinking = state === "thinking";
  const showListening = state === "listening";
  const showAny = showBubble || showThinking || showListening;

  if (!showAny) return null;

  return (
    <div className="absolute inset-x-4 top-[8%] flex justify-center pointer-events-none z-10">
      <div className="max-w-[85%]">
        {showListening && <ListeningBubble />}
        {showThinking && <ThinkingDots />}
        {showBubble && (
          <SpeechBubble
            text={text}
            isVisible
            typewriter={false}
            onComplete={onSpeakingComplete}
          />
        )}
      </div>
    </div>
  );
}
