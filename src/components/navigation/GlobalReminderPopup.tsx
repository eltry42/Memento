"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppNotification, useNotifications } from "@/hooks/useNotifications";

export default function GlobalReminderPopup() {
  const { notifications } = useNotifications({
    includeDueReminders: true,
    includeLocalNotifications: false,
    markDueRemindersNotified: true,
  });

  const reminderNotifications = useMemo(
    () => notifications.filter((item) => item.type === "reminder"),
    [notifications],
  );

  const seenReminderIdsRef = useRef<Set<string>>(new Set());
  const [popupQueue, setPopupQueue] = useState<AppNotification[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPopupQueue((previous) => {
        const queuedIds = new Set(previous.map((item) => item.id));
        const unseen = reminderNotifications.filter(
          (item) =>
            !seenReminderIdsRef.current.has(item.id) && !queuedIds.has(item.id),
        );

        unseen.forEach((item) => seenReminderIdsRef.current.add(item.id));
        return unseen.length > 0 ? [...previous, ...unseen] : previous;
      });
    }, 0);

    return () => clearTimeout(timeout);
  }, [reminderNotifications]);

  const activePopup = popupQueue[0] ?? null;
  const closePopup = () => {
    setPopupQueue((previous) => previous.slice(1));
  };

  if (!activePopup) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy/40 px-4">
      <div className="glass-heavy relative w-full max-w-sm rounded-2xl p-5 shadow-xl">
        <button
          type="button"
          onClick={closePopup}
          aria-label="Close reminder popup"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold leading-none text-navy/60 transition-colors hover:bg-white/50 hover:text-navy"
        >
          ×
        </button>
        <h3 className="text-base font-bold text-navy">Reminder</h3>
        <p className="mt-2 pr-7 text-sm text-navy/80">{activePopup.message}</p>
      </div>
    </div>
  );
}
