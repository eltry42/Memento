"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrCreateSessionId } from "@/lib/client-session";

export interface AppNotification {
  id: string;
  type: "mood" | "medication" | "checkin" | "reminder";
  message: string;
  severity: "warning" | "info";
  timestamp: number;
}

const MOOD_KEY = "memento-mood";
const REMINDERS_KEY = "memento-reminders";
const DISMISSED_KEY = "memento-notifications-dismissed";

interface MoodEntry {
  date: string;
  key: string;
}

interface LegacyReminder {
  id: string;
  text: string;
  time: string;
  type: "general" | "medication";
  taken?: boolean;
}

interface DueReminderNotification {
  reminderId: string;
  title: string;
  eventAt: string;
  scheduledFor: string;
  offsetHours: 12 | 6 | 1 | 0;
}

interface UseNotificationsOptions {
  includeDueReminders?: boolean;
  includeLocalNotifications?: boolean;
  markDueRemindersNotified?: boolean;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === getTodayKey()) return new Set(parsed.ids);
    }
  } catch {
    // ignore parse failures
  }
  return new Set();
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(
    DISMISSED_KEY,
    JSON.stringify({ date: getTodayKey(), ids: [...ids] }),
  );
}

function generateLocalNotifications(): AppNotification[] {
  const today = getTodayKey();
  const notifications: AppNotification[] = [];

  try {
    const raw = localStorage.getItem(MOOD_KEY);
    if (raw) {
      const mood: MoodEntry = JSON.parse(raw);
      if (mood.date === today) {
        if (
          mood.key === "wellness.mood.sad" ||
          mood.key === "wellness.mood.low"
        ) {
          notifications.push({
            id: `mood-low-${today}`,
            type: "mood",
            message: "Mood is low today — consider checking in",
            severity: "warning",
            timestamp: Date.now(),
          });
        }
      } else {
        notifications.push({
          id: `checkin-missing-${today}`,
          type: "checkin",
          message: "No mood check-in today",
          severity: "info",
          timestamp: Date.now(),
        });
      }
    } else {
      notifications.push({
        id: `checkin-missing-${today}`,
        type: "checkin",
        message: "No mood check-in today",
        severity: "info",
        timestamp: Date.now(),
      });
    }
  } catch {
    // ignore parse failures
  }

  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (raw) {
      const reminders: LegacyReminder[] = JSON.parse(raw);
      const medications = reminders.filter((r) => r.type === "medication");
      const missed = medications.filter((r) => !r.taken);
      if (missed.length > 0) {
        notifications.push({
          id: `meds-missed-${today}`,
          type: "medication",
          message: `${missed.length} medication${missed.length > 1 ? "s" : ""} not taken yet`,
          severity: "warning",
          timestamp: Date.now(),
        });
      }
    }
  } catch {
    // ignore parse failures
  }

  return notifications;
}

async function fetchDueReminderNotifications(
  sessionId: string,
  markNotified: boolean,
): Promise<AppNotification[]> {
  const response = await fetch(
    `/api/reminders?sessionId=${encodeURIComponent(sessionId)}&dueOnly=true&markNotified=${markNotified ? "true" : "false"}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch due reminders (${response.status})`);
  }

  const data = (await response.json()) as {
    notifications?: DueReminderNotification[];
  };

  return (data.notifications ?? []).map((item) => ({
    id: `reminder-${item.reminderId}-${item.offsetHours}-${item.eventAt}`,
    type: "reminder",
    message:
      item.offsetHours === 0
        ? `Reminder now: ${item.title}`
        : `${item.title} in ${item.offsetHours} hour${item.offsetHours > 1 ? "s" : ""}`,
    severity: item.offsetHours <= 1 ? "warning" : "info",
    timestamp: Date.now(),
  }));
}

export function useNotifications(options?: UseNotificationsOptions) {
  const includeDueReminders = options?.includeDueReminders ?? true;
  const includeLocalNotifications = options?.includeLocalNotifications ?? true;
  const markDueRemindersNotified = options?.markDueRemindersNotified ?? false;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const local = includeLocalNotifications ? generateLocalNotifications() : [];

    let reminderNotifications: AppNotification[] = [];
    if (includeDueReminders) {
      try {
        const sessionId = getOrCreateSessionId();
        if (sessionId) {
          reminderNotifications = await fetchDueReminderNotifications(
            sessionId,
            markDueRemindersNotified,
          );
        }
      } catch {
        // swallow reminder fetch errors so local alerts keep working
      }
    }

    const all = [...reminderNotifications, ...local];
    const currentDismissed = getDismissed();
    setDismissed(currentDismissed);
    setNotifications(all.filter((n) => !currentDismissed.has(n.id)));
  }, [includeDueReminders, includeLocalNotifications, markDueRemindersNotified]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refresh();
    }, 0);
    const interval = setInterval(() => {
      void refresh();
    }, 30000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [refresh]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    const allIds = new Set(dismissed);
    notifications.forEach((n) => allIds.add(n.id));
    saveDismissed(allIds);
    setDismissed(allIds);
    setNotifications([]);
  }, [dismissed, notifications]);

  return {
    notifications,
    count: notifications.length,
    dismiss,
    dismissAll,
    refresh,
  };
}
