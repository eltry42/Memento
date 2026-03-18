"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MOCK_WELLNESS_ACTIVITIES, MOCK_WELLNESS_STREAK } from "@/lib/mock-data";
import { useLanguage } from "@/hooks/useLanguage";
import { useMode } from "@/hooks/useMode";

const MOOD_KEYS = [
  { emoji: "😊", key: "wellness.mood.great" },
  { emoji: "🙂", key: "wellness.mood.good" },
  { emoji: "😐", key: "wellness.mood.okay" },
  { emoji: "😔", key: "wellness.mood.low" },
  { emoji: "😢", key: "wellness.mood.sad" },
];

const STORAGE_KEY = "memento-mood";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getSavedMood(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.date === getTodayKey()) return parsed.key;
    return null;
  } catch {
    return null;
  }
}

function saveMood(key: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), key }));
}

const activityBorders: Record<string, string> = {
  teal: "border-l-teal",
  "warm-pink": "border-l-warm-pink",
  sage: "border-l-sage",
};

function ActivityIcon({ icon }: { icon: string }) {
  if (icon === "puzzle") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
      </svg>
    );
  }
  if (icon === "book") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    );
  }
  // music
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.846a1.5 1.5 0 00-1.956-1.43L9 5.25v4.5m0 5.944v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 14.556z" />
    </svg>
  );
}

export default function WellnessPage() {
  const { t } = useLanguage();
  const { mode } = useMode();
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mode === "caretaker") {
      router.replace("/dashboard");
      return;
    }
    setMounted(true);
    setSelectedMood(getSavedMood());
  }, [mode, router]);

  function handleMoodSelect(key: string) {
    setSelectedMood(key);
    saveMood(key);
  }

  return (
    <div className="h-[100dvh] overflow-y-auto bg-cream-50 pt-24 px-5 pb-10">
      <div className="max-w-md mx-auto space-y-5">
        {/* Mood Check */}
        <div className="glass-heavy rounded-2xl p-6">
          <h2 className="text-xl font-bold text-navy mb-4">{t("wellness.moodTitle")}</h2>
          <div className="flex justify-between">
            {MOOD_KEYS.map((mood) => (
              <button
                key={mood.key}
                onClick={() => handleMoodSelect(mood.key)}
                className={`flex flex-col items-center gap-1.5 transition-transform active:scale-95 ${
                  mounted && selectedMood === mood.key ? "scale-110" : ""
                }`}
              >
                <span
                  className={`flex items-center justify-center w-14 h-14 rounded-full text-3xl transition-shadow ${
                    mounted && selectedMood === mood.key
                      ? "ring-3 ring-teal shadow-md bg-white/60"
                      : "bg-white/30"
                  }`}
                >
                  {mood.emoji}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    mounted && selectedMood === mood.key ? "text-teal" : "text-navy/60"
                  }`}
                >
                  {t(mood.key)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Activities */}
        <div className="glass-heavy rounded-2xl p-6">
          <h2 className="text-xl font-bold text-navy mb-4">{t("wellness.activities")}</h2>
          <div className="space-y-3">
            {MOCK_WELLNESS_ACTIVITIES.map((activity) => {
              const cardContent = (
                <div
                  className={`flex items-center gap-4 p-4 rounded-xl bg-white/30 border-l-4 ${
                    activityBorders[activity.color] || "border-l-teal"
                  } active:scale-95 transition-transform cursor-pointer min-h-12`}
                >
                  <span className="text-navy/70 shrink-0">
                    <ActivityIcon icon={activity.icon} />
                  </span>
                  <div>
                    <p className="font-semibold text-sm text-navy">{activity.title}</p>
                    <p className="text-xs text-navy/50">{activity.description}</p>
                  </div>
                </div>
              );

              if (activity.id === "1") {
                return (
                  <Link key={activity.id} href="/wellness/memory-game">
                    {cardContent}
                  </Link>
                );
              }

              if (activity.id === "2") {
                return (
                  <Link key={activity.id} href="/wellness/story-time">
                    {cardContent}
                  </Link>
                );
              }

              return <div key={activity.id}>{cardContent}</div>;
            })}
          </div>
        </div>

        {/* Streak / Encouragement */}
        <div className="glass-heavy rounded-2xl p-6 text-center">
          <span className="text-4xl mb-3 block">⭐</span>
          <p className="text-lg font-bold text-navy">{MOCK_WELLNESS_STREAK.message}</p>
          <p className="text-sm text-navy/60 mt-1">{t("wellness.keepItUp")}</p>
        </div>
      </div>
    </div>
  );
}
