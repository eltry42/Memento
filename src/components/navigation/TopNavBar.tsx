"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavTabs } from "@/lib/constants";
import NavIcon from "./NavIcon";
import { useLanguage } from "@/hooks/useLanguage";
import { useMode } from "@/hooks/useMode";
import { AppNotification, useNotifications } from "@/hooks/useNotifications";

const NAV_LABEL_KEYS: Record<string, string> = {
  home: "nav.home",
  dashboard: "nav.dashboard",
  wellness: "nav.wellness",
  reminders: "nav.reminders",
  schedule: "nav.schedule",
  settings: "nav.settings",
};

export default function TopNavBar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { mode } = useMode();
  const { notifications, count } = useNotifications({
    includeDueReminders: true,
    markDueRemindersNotified: true,
  });
  const tabs = getNavTabs(mode);
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

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 safe-top">
        <div className="glass mx-3 mt-2 rounded-2xl px-2 py-1.5 flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            const showBadge = tab.id === "dashboard" && count > 0;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[48px] min-h-[48px] justify-center transition-colors ${
                  isActive
                    ? "text-teal bg-white/30"
                    : "text-navy/60 hover:text-navy"
                }`}
              >
                <NavIcon icon={tab.icon} className="w-5 h-5" />
                {showBadge && (
                  <span className="absolute top-0.5 right-1 w-4 h-4 rounded-full bg-warm-pink text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
                <span className="text-[10px] font-semibold leading-tight">
                  {t(NAV_LABEL_KEYS[tab.id] ?? tab.label)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {activePopup ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/40 px-4">
          <div className="glass-heavy w-full max-w-sm rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-navy">Reminder</h3>
            <p className="mt-2 text-sm text-navy/80">{activePopup.message}</p>
            <button
              type="button"
              onClick={closePopup}
              className="mt-4 w-full rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
