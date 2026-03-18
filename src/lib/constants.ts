import { NavTab } from "@/types/navigation";
import { Mode } from "@/hooks/useMode";

const ALL_NAV_TABS: NavTab[] = [
  { id: "home", label: "Home", href: "/home", icon: "home" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { id: "wellness", label: "Wellness", href: "/wellness", icon: "heart" },
  { id: "reminders", label: "Reminders", href: "/reminders", icon: "bell" },
  { id: "schedule", label: "Schedule", href: "/schedule", icon: "calendar" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

const ELDERLY_TAB_IDS = new Set(["home", "wellness", "settings"]);
const CARETAKER_TAB_IDS = new Set(["dashboard", "reminders", "schedule", "settings"]);

export function getNavTabs(mode: Mode): NavTab[] {
  const allowed = mode === "elderly" ? ELDERLY_TAB_IDS : CARETAKER_TAB_IDS;
  return ALL_NAV_TABS.filter((tab) => allowed.has(tab.id));
}

// Keep for backward compat
export const NAV_TABS = ALL_NAV_TABS;

export const TYPEWRITER_SPEED = 35; // ms per character
export const LISTENING_DURATION = 2000; // ms
export const THINKING_DURATION = 1500; // ms

// The amount of silence (in milliseconds) to wait before the microphone cuts off.
export const VAD_REDEMPTION_MS = 3000;

// Choose avatar mode
export const ACTIVE_MODELS = {
  AUNTIE_V1: "/models/AuntieM.glb",
  AUNTIE_V2: "/models/AuntieM1.glb",
} as const;
export const SELECTED_MODEL_URL = ACTIVE_MODELS.AUNTIE_V1; // Change this to switch models globally