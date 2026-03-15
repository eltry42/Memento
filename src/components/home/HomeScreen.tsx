"use client";

import { useEffect, useRef, useState } from "react";
import AvatarComposite from "@/components/avatar/AvatarComposite";
import ChatBubbleOverlay from "./ChatBubbleOverlay";
import BottomControls from "./BottomControls";
import ChatLog from "./ChatLog";
import { useAvatarState } from "@/hooks/useAvatarState";
import { useRealConversation } from "@/hooks/useRealConversation";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";

interface ReminderNotificationApiItem {
  reminderId: string;
  title: string;
  eventAt: string;
  scheduledFor: string;
  offsetHours: 12 | 6 | 1 | 0;
}

export default function HomeScreen() {
  const { state, dispatch } = useAvatarState();
  const [isChatLogOpen, setIsChatLogOpen] = useState(false);
  const inFlightReminderCheckRef = useRef(false);

  const {
    bubbleText,
    messages,
    sessionId,
    handleMicPress,
    handleGreetingComplete,
    handleSpeakingComplete,
    addAssistantMessage,
  } = useRealConversation({ dispatch });

  const micDisabled = state !== "idle" && state !== "greeting";

  const onSpeakingComplete = () => {
    if (state === "greeting") {
      handleGreetingComplete();
    } else {
      handleSpeakingComplete();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.Notification) return;

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        // Ignore permission failures in MVP mode.
      });
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const notifyDueReminders = async () => {
      if (inFlightReminderCheckRef.current) return;
      inFlightReminderCheckRef.current = true;

      try {
        const response = await fetch(
          `/api/reminders?sessionId=${encodeURIComponent(sessionId)}&dueOnly=true&markNotified=true`,
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const notifications: ReminderNotificationApiItem[] = data.notifications ?? [];

        notifications.forEach((notification) => {
          const eventAtText = new Date(notification.eventAt).toLocaleString();
          const prefix =
            notification.offsetHours === 0
              ? "now"
              : `${notification.offsetHours} hour${notification.offsetHours === 1 ? "" : "s"} before`;

          const reminderText = `Reminder (${prefix}): ${notification.title} at ${eventAtText}.`;
          addAssistantMessage(reminderText);

          if (typeof window !== "undefined" && window.Notification) {
            if (Notification.permission === "granted") {
              new Notification("Memento reminder", {
                body: reminderText,
              });
            } else {
              window.alert(reminderText);
            }
          }
        });
      } catch {
        // Ignore reminder polling failures in MVP mode.
      } finally {
        inFlightReminderCheckRef.current = false;
      }
    };

    notifyDueReminders();
    const interval = window.setInterval(notifyDueReminders, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [sessionId, addAssistantMessage]);

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
