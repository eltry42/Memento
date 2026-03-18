"use client";

import { SessionPhase } from "@/types/session";
import { useLanguage } from "@/hooks/useLanguage";

interface MicButtonProps {
  sessionPhase: SessionPhase;
  isMuted: boolean;
  isListening: boolean;
  onPress: () => void;
  disabled?: boolean;
}

function MicIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );
}

function PulseRings() {
  return (
    <>
      <span className="absolute inset-0 rounded-full bg-green-400/30 animate-[ping_2s_ease-out_infinite]" />
      <span className="absolute -inset-3 rounded-full bg-green-400/15 animate-[ping_2s_ease-out_0.5s_infinite]" />
    </>
  );
}

export default function MicButton({
  sessionPhase,
  isMuted,
  isListening,
  onPress,
  disabled,
}: MicButtonProps) {
  const { t } = useLanguage();
  const isConnecting = sessionPhase === "connecting";
  const isActive = sessionPhase === "active";

  // --- Determine visual state ---
  let bgClass = "bg-gray-600/70";
  let ringClass = "ring-2 ring-white/20";
  let label = t("mic.startTalking");
  let showPulse = false;

  if (isConnecting) {
    bgClass = "bg-gray-600/70";
    label = t("mic.connecting");
  } else if (isActive && isMuted) {
    bgClass = "bg-red-500/80";
    ringClass = "ring-4 ring-red-300/50";
    label = t("mic.unmute");
  } else if (isActive && isListening) {
    bgClass = "bg-green-500";
    ringClass = "ring-4 ring-green-300/60";
    showPulse = true;
    label = t("mic.listening");
  } else if (isActive && !isMuted) {
    bgClass = "bg-teal-500/80";
    ringClass = "ring-2 ring-teal-300/40";
    label = t("mic.mute");
  }

  const isDisabled = disabled || isConnecting;

  let ariaLabel = t("mic.startTalking");
  if (isConnecting) ariaLabel = t("mic.connecting");
  else if (isActive && isMuted) ariaLabel = t("mic.unmute");
  else if (isActive) ariaLabel = t("mic.mute");

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onPress}
        disabled={isDisabled}
        className={`
          relative flex items-center justify-center
          w-24 h-24 rounded-full
          transition-all duration-300
          active:scale-90
          shadow-lg shadow-black/30
          ${bgClass} ${ringClass}
          ${isDisabled ? "opacity-50" : ""}
        `}
        aria-label={ariaLabel}
      >
        {showPulse && <PulseRings />}

        <span className="relative z-10 text-white">
          {isConnecting ? (
            <Spinner />
          ) : isActive && isMuted ? (
            <MicOffIcon size={40} />
          ) : (
            <MicIcon size={40} />
          )}
        </span>
      </button>

      <span className={`
        text-sm font-medium tracking-wide
        transition-colors duration-300
        ${isActive && isListening ? "text-green-300" : "text-white/70"}
      `}>
        {label}
      </span>
    </div>
  );
}
