"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/hooks/useLanguage";
import { useNotifications } from "@/hooks/useNotifications";
import { getOrCreateSessionId } from "@/lib/client-session";

// ── localStorage keys (shared with other pages) ──
const MOOD_KEY = "memento-mood";
const REMINDERS_KEY = "memento-reminders";
const SCHEDULE_KEY = "memento-schedule";
const CONVERSATION_KEY = "memento-last-conversation";

// ── Types ──
interface MoodEntry {
  date: string;
  key: string;
}

interface Reminder {
  id: string;
  text: string;
  time: string;
  type: "general" | "medication";
  dosage?: string;
  taken?: boolean;
}

interface ScheduleEvent {
  id: string;
  title: string;
  time: string;
  type: string;
  date: string;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

// ── Helpers ──
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getMoodEmoji(key: string): string {
  const map: Record<string, string> = {
    "wellness.mood.great": "😊",
    "wellness.mood.good": "🙂",
    "wellness.mood.okay": "😐",
    "wellness.mood.low": "😔",
    "wellness.mood.sad": "😢",
  };
  return map[key] ?? "—";
}

function getMoodLabel(key: string): string {
  const map: Record<string, string> = {
    "wellness.mood.great": "Great",
    "wellness.mood.good": "Good",
    "wellness.mood.okay": "Okay",
    "wellness.mood.low": "Low",
    "wellness.mood.sad": "Sad",
  };
  return map[key] ?? "Unknown";
}

function getMoodScore(key?: string | null): number | null {
  if (!key) return null;

  const map: Record<string, number> = {
    "wellness.mood.great": 100,
    "wellness.mood.good": 82,
    "wellness.mood.okay": 62,
    "wellness.mood.low": 35,
    "wellness.mood.sad": 18,
  };

  return map[key] ?? null;
}

function getProgressTone(value: number | null) {
  if (value == null) return "bg-gray-300";
  if (value >= 80) return "bg-teal";
  if (value >= 50) return "bg-amber-400";
  return "bg-warm-pink";
}

// ── Component ──
export default function DashboardPage() {
  const { t } = useLanguage();
  const { notifications, dismiss, dismissAll } = useNotifications();
  const [mounted, setMounted] = useState(false);
  const [mood, setMood] = useState<MoodEntry | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [lastConversation, setLastConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [convoExpanded, setConvoExpanded] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const sessionId = getOrCreateSessionId();
      const res = await fetch(`/api/conversation?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.messages ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    // Load mood
    try {
      const raw = localStorage.getItem(MOOD_KEY);
      if (raw) setMood(JSON.parse(raw));
    } catch { /* ignore */ }

    // Load reminders
    try {
      const raw = localStorage.getItem(REMINDERS_KEY);
      if (raw) setReminders(JSON.parse(raw));
    } catch { /* ignore */ }

    // Load schedule
    try {
      const raw = localStorage.getItem(SCHEDULE_KEY);
      if (raw) setSchedule(JSON.parse(raw));
    } catch { /* ignore */ }

    // Load last conversation time
    try {
      const raw = localStorage.getItem(CONVERSATION_KEY);
      if (raw) setLastConversation(raw);
    } catch { /* ignore */ }

    fetchConversations();
    setMounted(true);
  }, [fetchConversations]);

  const today = getTodayKey();
  const isMoodToday = mood?.date === today;
  const isMoodLow = mood?.key === "wellness.mood.low" || mood?.key === "wellness.mood.sad";

  const medicationReminders = reminders.filter((r) => r.type === "medication");
  const takenCount = medicationReminders.filter((r) => r.taken).length;
  const totalMeds = medicationReminders.length;
  const adherencePercent = totalMeds > 0 ? Math.round((takenCount / totalMeds) * 100) : null;
  const activeReminders = reminders.filter((r) => !r.taken).length;
  const moodScore = isMoodToday ? getMoodScore(mood?.key) : null;
  const todayConversationCount = conversations.filter((message) =>
    message.createdAt.startsWith(today)
  ).length;
  const engagementPercent = Math.min(100, todayConversationCount * 20);
  const attentionItems = notifications.length + (isMoodLow && isMoodToday ? 1 : 0);

  const todayEvents = schedule.filter((e) => e.date === today);

  if (!mounted) return null;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-cream-50 pt-24 px-5 pb-10">
      <div className="max-w-md mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-navy">
          {t("dashboard.title") ?? "Dashboard"}
        </h1>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Mood */}
          <div className={`glass-heavy rounded-2xl p-5 ${isMoodLow && isMoodToday ? "ring-2 ring-warm-pink" : ""}`}>
            <p className="text-xs font-bold text-navy/40 mb-2">
              {t("dashboard.mood") ?? "Today's Mood"}
            </p>
            {isMoodToday && mood ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl">{getMoodEmoji(mood.key)}</span>
                <span className="text-sm font-bold text-navy">{getMoodLabel(mood.key)}</span>
              </div>
            ) : (
              <p className="text-sm text-navy/40 font-semibold">No check-in yet</p>
            )}
            {isMoodLow && isMoodToday && (
              <p className="text-xs text-warm-pink font-bold mt-2">Needs attention</p>
            )}
          </div>

          {/* Medication Adherence */}
          <div className="glass-heavy rounded-2xl p-5">
            <p className="text-xs font-bold text-navy/40 mb-2">
              {t("dashboard.medication") ?? "Medication"}
            </p>
            {adherencePercent !== null ? (
              <>
                <p className="text-3xl font-bold text-navy">{adherencePercent}%</p>
                <p className="text-xs text-navy/50 font-semibold">
                  {takenCount}/{totalMeds} taken
                </p>
              </>
            ) : (
              <p className="text-sm text-navy/40 font-semibold">No medications set</p>
            )}
          </div>

          {/* Upcoming Appointments */}
          <div className="glass-heavy rounded-2xl p-5">
            <p className="text-xs font-bold text-navy/40 mb-2">
              {t("dashboard.appointments") ?? "Today's Events"}
            </p>
            <p className="text-3xl font-bold text-navy">{todayEvents.length}</p>
            <p className="text-xs text-navy/50 font-semibold">scheduled</p>
          </div>

          {/* Last Conversation */}
          <div className="glass-heavy rounded-2xl p-5">
            <p className="text-xs font-bold text-navy/40 mb-2">
              {t("dashboard.lastChat") ?? "Last Chat"}
            </p>
            {lastConversation ? (
              <p className="text-sm font-bold text-navy">{lastConversation}</p>
            ) : (
              <p className="text-sm text-navy/40 font-semibold">No conversation yet</p>
            )}
          </div>
        </div>

        <div className="glass-heavy rounded-2xl p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy/40">
                Analytics
              </p>
              <h2 className="mt-1 text-lg font-bold text-navy">
                Uncle Tan&apos;s Stats
              </h2>
              <p className="mt-1 text-sm text-navy/55">
                A quick caretaker snapshot of mood, medication, and engagement.
              </p>
            </div>
            <div className="rounded-2xl bg-white/45 px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-navy/35">
                Attention
              </p>
              <p className="text-2xl font-bold text-navy">{attentionItems}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white/35 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-navy">Mood Check-In</p>
                  <p className="text-xs text-navy/45">
                    {isMoodToday && mood
                      ? `${getMoodEmoji(mood.key)} ${getMoodLabel(mood.key)} today`
                      : "No mood check-in recorded today"}
                  </p>
                </div>
                <p className="text-sm font-bold text-navy">
                  {moodScore != null ? `${moodScore}%` : "Pending"}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-navy/10">
                <div
                  className={`h-full rounded-full transition-all ${getProgressTone(moodScore)}`}
                  style={{ width: `${moodScore ?? 8}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white/35 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-navy">Medication Adherence</p>
                  <p className="text-xs text-navy/45">
                    {totalMeds > 0
                      ? `${takenCount} of ${totalMeds} medication reminders marked taken`
                      : "No medication reminders have been set yet"}
                  </p>
                </div>
                <p className="text-sm font-bold text-navy">
                  {adherencePercent != null ? `${adherencePercent}%` : "N/A"}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-navy/10">
                <div
                  className={`h-full rounded-full transition-all ${getProgressTone(adherencePercent)}`}
                  style={{ width: `${adherencePercent ?? 8}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white/35 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-navy">Engagement</p>
                  <p className="text-xs text-navy/45">
                    Based on conversations logged with Auntie Mimi today
                  </p>
                </div>
                <p className="text-sm font-bold text-navy">{todayConversationCount} msgs</p>
              </div>

              <div className="mb-3 h-2 overflow-hidden rounded-full bg-navy/10">
                <div
                  className={`h-full rounded-full transition-all ${getProgressTone(engagementPercent)}`}
                  style={{ width: `${Math.max(engagementPercent, 8)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/45 px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy/35">
                    Active
                  </p>
                  <p className="mt-1 text-lg font-bold text-navy">{activeReminders}</p>
                  <p className="text-[11px] text-navy/45">reminders</p>
                </div>
                <div className="rounded-xl bg-white/45 px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy/35">
                    Today
                  </p>
                  <p className="mt-1 text-lg font-bold text-navy">{todayEvents.length}</p>
                  <p className="text-[11px] text-navy/45">events</p>
                </div>
                <div className="rounded-xl bg-white/45 px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy/35">
                    Alerts
                  </p>
                  <p className="mt-1 text-lg font-bold text-navy">{notifications.length}</p>
                  <p className="text-[11px] text-navy/45">open</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Notifications / Alerts ── */}
        {notifications.length > 0 && (
          <div className="glass-heavy rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy/60">
                {t("dashboard.alerts") ?? "Alerts"}
              </h2>
              <button
                onClick={dismissAll}
                className="text-xs font-bold text-navy/40 active:scale-95 transition-transform"
              >
                Dismiss all
              </button>
            </div>

            {notifications.map((n) => {
              const icon = n.type === "mood" ? "⚠️" : n.type === "medication" ? "💊" : "📋";
              const bg = n.severity === "warning"
                ? "bg-warm-pink/10 border-warm-pink/20"
                : "bg-teal/10 border-teal/20";
              return (
                <div key={n.id} className={`flex items-center gap-3 p-3 rounded-xl border ${bg}`}>
                  <span className="text-lg">{icon}</span>
                  <p className="text-sm font-semibold text-navy flex-1">{n.message}</p>
                  <button
                    onClick={() => dismiss(n.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-navy/30 hover:text-navy/60 active:scale-90 transition-all shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Today's Schedule ── */}
        <div className="glass-heavy rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-navy/60">
              {t("dashboard.todaySchedule") ?? "Today's Schedule"}
            </h2>
            <Link href="/schedule" className="text-xs font-bold text-teal active:scale-95 transition-transform">
              {t("dashboard.viewAll") ?? "View All"}
            </Link>
          </div>
          {todayEvents.length === 0 ? (
            <p className="text-sm text-navy/40 font-semibold">No events today</p>
          ) : (
            <div className="space-y-2">
              {todayEvents.slice(0, 5).map((evt) => (
                <div key={evt.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/30">
                  <span className="text-xs font-bold text-navy/40 w-16 shrink-0">{evt.time}</span>
                  <p className="text-sm font-semibold text-navy truncate">{evt.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Conversation Log ── */}
        <div className="glass-heavy rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-navy/60">
              Recent Conversations
            </h2>
            {conversations.length > 6 && (
              <button
                onClick={() => setConvoExpanded(!convoExpanded)}
                className="text-xs font-bold text-teal active:scale-95 transition-transform"
              >
                {convoExpanded ? "Show Less" : "View All"}
              </button>
            )}
          </div>
          {conversations.length === 0 ? (
            <p className="text-sm text-navy/40 font-semibold">
              No conversations yet — your loved one hasn&apos;t chatted with Auntie Mimi yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {(convoExpanded ? conversations : conversations.slice(-6))
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl ${
                      msg.role === "user"
                        ? "bg-teal-50/50 ml-4"
                        : "bg-white/40 mr-4"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-navy/40">
                        {msg.role === "user" ? "Your loved one" : "Auntie Mimi"}
                      </span>
                      <span className="text-[10px] text-navy/25">
                        {new Date(msg.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-navy leading-relaxed">{msg.text}</p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/reminders"
            className="glass-heavy rounded-2xl p-5 text-center active:scale-95 transition-transform"
          >
            <span className="text-2xl block mb-2">💊</span>
            <p className="text-sm font-bold text-navy">
              {t("dashboard.addMedication") ?? "Manage Medications"}
            </p>
          </Link>
          <Link
            href="/schedule"
            className="glass-heavy rounded-2xl p-5 text-center active:scale-95 transition-transform"
          >
            <span className="text-2xl block mb-2">📅</span>
            <p className="text-sm font-bold text-navy">
              {t("dashboard.addAppointment") ?? "Manage Schedule"}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
