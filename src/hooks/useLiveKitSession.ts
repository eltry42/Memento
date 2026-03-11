"use client";

// Gets connectionConfig token
import { useCallback, useState } from "react";
import { SessionPhase } from "@/types/session";

interface ConnectionConfig {
  serverUrl: string;
  token: string;
}

interface UseLiveKitSessionReturn {
  sessionPhase: SessionPhase;
  connectionConfig: ConnectionConfig | null;
  startSession: () => Promise<void>;
  endSession: () => void;
}

export function useLiveKitSession(): UseLiveKitSessionReturn {
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>("idle");
  const [connectionConfig, setConnectionConfig] =
    useState<ConnectionConfig | null>(null);

  const startSession = useCallback(async () => {
    if (sessionPhase !== "idle") return;

    setSessionPhase("connecting"); // Update UI

    try {
      const roomName = `memento-${Date.now()}`;
      const participantName = `user-${Date.now()}`;

      const res = await fetch("/api/livekit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, participantName }),
      });

      if (!res.ok) {
        throw new Error(`Token fetch failed: ${res.status}`);
      }

      const { token } = await res.json();
      const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

      if (!serverUrl) {
        throw new Error("NEXT_PUBLIC_LIVEKIT_URL not configured");
      }

      setConnectionConfig({ serverUrl, token });
      setSessionPhase("active");
    } catch (err) {
      console.error("Failed to start LiveKit session:", err);
      setSessionPhase("idle");
      setConnectionConfig(null);
    }
  }, [sessionPhase]);

  const endSession = useCallback(() => {
    setSessionPhase("disconnecting");
    setConnectionConfig(null);
    // Small delay to allow cleanup before returning to idle
    setTimeout(() => {
      setSessionPhase("idle");
    }, 500);
  }, []);

  return { sessionPhase, connectionConfig, startSession, endSession };
}
