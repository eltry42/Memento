"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavTabs } from "@/lib/constants";
import NavIcon from "./NavIcon";
import { useLanguage } from "@/hooks/useLanguage";
import { useMode } from "@/hooks/useMode";

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
  const tabs = getNavTabs(mode);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 safe-top">
        <div className="glass mx-3 mt-2 rounded-2xl px-2 py-1.5 flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
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
                <span className="text-[10px] font-semibold leading-tight">
                  {t(NAV_LABEL_KEYS[tab.id] ?? tab.label)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
