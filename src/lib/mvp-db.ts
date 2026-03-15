import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface StoredConversationMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

export type ReminderType = "appointment" | "medication" | "general";
export type ReminderKind = "one-off" | "recurring";
export type RecurringPattern = "daily" | "weekly";

export interface ReminderItem {
  id: string;
  sessionId: string;
  type: ReminderType;
  kind: ReminderKind;
  title: string;
  sourceText: string;
  dueAt: string | null;
  recurringPattern: RecurringPattern | null;
  recurringTime: string | null; // HH:mm
  recurringWeekday: number | null; // 0-6 (Sun-Sat), only for weekly
  status: "active" | "done";
  createdAt: string;
  notificationHistory: string[];
}

export interface ReminderNotification {
  reminderId: string;
  title: string;
  eventAt: string;
  scheduledFor: string;
  offsetHours: 12 | 6 | 1 | 0;
  notificationKey: string;
}

interface MementoDb {
  conversations: StoredConversationMessage[];
  reminders: ReminderItem[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "memento-db.json");
const REMINDER_OFFSETS_HOURS = [12, 6, 1, 0] as const;

function ensureDb(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!existsSync(DB_FILE)) {
    const initialData: MementoDb = { conversations: [], reminders: [] };
    writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

function normalizeReminder(reminder: ReminderItem): ReminderItem {
  return {
    ...reminder,
    kind: reminder.kind ?? "one-off",
    recurringPattern: reminder.recurringPattern ?? null,
    recurringTime: reminder.recurringTime ?? null,
    recurringWeekday: reminder.recurringWeekday ?? null,
    status: reminder.status ?? "active",
    notificationHistory: reminder.notificationHistory ?? [],
  };
}

function readDb(): MementoDb {
  ensureDb();
  const raw = readFileSync(DB_FILE, "utf-8");
  const parsed = JSON.parse(raw) as MementoDb;

  return {
    conversations: parsed.conversations ?? [],
    reminders: (parsed.reminders ?? []).map((reminder) =>
      normalizeReminder(reminder),
    ),
  };
}

function writeDb(db: MementoDb): void {
  ensureDb();
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveConversationPair(params: {
  sessionId: string;
  userText: string;
  aiText: string;
}): StoredConversationMessage[] {
  const db = readDb();
  const now = new Date().toISOString();

  const messages: StoredConversationMessage[] = [
    {
      id: nextId("msg"),
      sessionId: params.sessionId,
      role: "user",
      text: params.userText,
      createdAt: now,
    },
    {
      id: nextId("msg"),
      sessionId: params.sessionId,
      role: "assistant",
      text: params.aiText,
      createdAt: now,
    },
  ];

  db.conversations.push(...messages);
  writeDb(db);

  return messages;
}

function parseExplicitDateTime(sourceText: string): Date | null {
  const match = sourceText.match(
    /(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
  );

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const rawYear = match[3] ? Number(match[3]) : new Date().getFullYear();
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  let hour = match[4] ? Number(match[4]) : 9;
  const minute = match[5] ? Number(match[5]) : 0;
  const ampm = match[6]?.toLowerCase();

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  const parsed = new Date(year, month, day, hour, minute, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRelativeDateTime(sourceText: string): Date | null {
  const lower = sourceText.toLowerCase();
  const date = new Date();

  if (lower.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
  } else if (lower.includes("next week")) {
    date.setDate(date.getDate() + 7);
  } else if (/(today|tonight|this evening)/.test(lower)) {
    // keep today
  } else {
    return null;
  }

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const ampm = timeMatch[3].toLowerCase();

    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    date.setHours(hour, minute, 0, 0);
  } else {
    date.setHours(9, 0, 0, 0);
  }

  return date;
}

function parseDueAt(sourceText: string): string | null {
  const explicit = parseExplicitDateTime(sourceText);
  if (explicit) return explicit.toISOString();

  const relative = parseRelativeDateTime(sourceText);
  if (relative) return relative.toISOString();

  return null;
}

export function createReminder(params: {
  sessionId: string;
  title: string;
  type?: ReminderType;
  kind: ReminderKind;
  dueAt?: string | null;
  recurringPattern?: RecurringPattern | null;
  recurringTime?: string | null;
  recurringWeekday?: number | null;
  sourceText?: string;
}): ReminderItem {
  const db = readDb();

  const reminder: ReminderItem = {
    id: nextId("rem"),
    sessionId: params.sessionId,
    type: params.type ?? "general",
    kind: params.kind,
    title: params.title,
    sourceText: params.sourceText ?? params.title,
    dueAt: params.kind === "one-off" ? params.dueAt ?? null : null,
    recurringPattern:
      params.kind === "recurring" ? params.recurringPattern ?? "daily" : null,
    recurringTime:
      params.kind === "recurring" ? params.recurringTime ?? "09:00" : null,
    recurringWeekday:
      params.kind === "recurring" ? params.recurringWeekday ?? null : null,
    status: "active",
    createdAt: new Date().toISOString(),
    notificationHistory: [],
  };

  db.reminders.push(reminder);
  writeDb(db);
  return reminder;
}

export function extractReminders(params: {
  sessionId: string;
  sourceText: string;
}): ReminderItem[] {
  const text = params.sourceText.trim();
  if (!text) return [];

  const lowerText = text.toLowerCase();
  const reminders: ReminderItem[] = [];

  const hasAppointmentSignal = /(doctor|appointment|clinic|hospital|checkup)/i.test(
    lowerText,
  );
  const hasMedicationSignal =
    /(medicine|medication|pill|tablet|take\s+my\s+med)/i.test(lowerText);
  const hasReminderSignal = /(remind me|don't forget|remember to|need to)/i.test(
    lowerText,
  );
  const dueAt = parseDueAt(text);

  if (hasAppointmentSignal) {
    reminders.push(
      createReminder({
        sessionId: params.sessionId,
        title: "Doctor appointment",
        type: "appointment",
        kind: "one-off",
        dueAt,
        sourceText: text,
      }),
    );
  }

  if (hasMedicationSignal) {
    reminders.push(
      createReminder({
        sessionId: params.sessionId,
        title: "Medication reminder",
        type: "medication",
        kind: "one-off",
        dueAt,
        sourceText: text,
      }),
    );
  }

  if (hasReminderSignal && reminders.length === 0) {
    reminders.push(
      createReminder({
        sessionId: params.sessionId,
        title: "General reminder",
        type: "general",
        kind: "one-off",
        dueAt,
        sourceText: text,
      }),
    );
  }

  return reminders;
}

export function listReminders(sessionId?: string): ReminderItem[] {
  const db = readDb();
  const reminders = sessionId
    ? db.reminders.filter((item) => item.sessionId === sessionId)
    : db.reminders;

  return reminders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function parseRecurringTime(reminder: ReminderItem): { hour: number; minute: number } {
  const [hourRaw = "9", minuteRaw = "0"] = (reminder.recurringTime ?? "09:00").split(":");
  return {
    hour: Number(hourRaw) || 9,
    minute: Number(minuteRaw) || 0,
  };
}

function getRecurringEventAt(reminder: ReminderItem, now: Date): Date | null {
  if (reminder.kind !== "recurring") return null;

  const { hour, minute } = parseRecurringTime(reminder);
  const event = new Date(now);
  event.setSeconds(0, 0);

  if (reminder.recurringPattern === "weekly") {
    const targetWeekday = reminder.recurringWeekday ?? now.getDay();
    const dayDiff = (targetWeekday - now.getDay() + 7) % 7;
    event.setDate(now.getDate() + dayDiff);
    event.setHours(hour, minute, 0, 0);

    if (event.getTime() <= now.getTime()) {
      event.setDate(event.getDate() + 7);
    }

    return event;
  }

  event.setHours(hour, minute, 0, 0);
  if (event.getTime() <= now.getTime()) {
    event.setDate(event.getDate() + 1);
  }

  return event;
}

function buildDueNotificationsForEvent(
  reminder: ReminderItem,
  eventAt: Date,
  now: Date,
): ReminderNotification[] {
  const notifications: ReminderNotification[] = [];

  REMINDER_OFFSETS_HOURS.forEach((offsetHours) => {
    const scheduled = new Date(eventAt.getTime() - offsetHours * 60 * 60 * 1000);
    const notificationKey = `${eventAt.toISOString()}|${offsetHours}`;

    if (scheduled.getTime() <= now.getTime()) {
      if (!reminder.notificationHistory.includes(notificationKey)) {
        notifications.push({
          reminderId: reminder.id,
          title: reminder.title,
          eventAt: eventAt.toISOString(),
          scheduledFor: scheduled.toISOString(),
          offsetHours,
          notificationKey,
        });
      }
    }
  });

  return notifications;
}

export function getDueReminderNotifications(params: {
  sessionId?: string;
  now?: Date;
}): ReminderNotification[] {
  const now = params.now ?? new Date();

  return listReminders(params.sessionId)
    .filter((reminder) => reminder.status === "active")
    .flatMap((reminder) => {
      if (reminder.kind === "one-off") {
        if (!reminder.dueAt) return [];
        const eventAt = new Date(reminder.dueAt);
        if (Number.isNaN(eventAt.getTime())) return [];

        return buildDueNotificationsForEvent(reminder, eventAt, now);
      }

      const eventAt = getRecurringEventAt(reminder, now);
      if (!eventAt) return [];

      return buildDueNotificationsForEvent(reminder, eventAt, now);
    })
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export function markReminderDone(reminderId: string): ReminderItem | null {
  const db = readDb();
  const index = db.reminders.findIndex((item) => item.id === reminderId);
  if (index === -1) return null;

  db.reminders[index].status = "done";
  writeDb(db);
  return db.reminders[index];
}

export function deleteReminder(reminderId: string): ReminderItem | null {
  const db = readDb();
  const index = db.reminders.findIndex((item) => item.id === reminderId);
  if (index === -1) return null;

  const removed = db.reminders.splice(index, 1)[0];
  writeDb(db);
  return removed;
}

export function markReminderNotificationSent(params: {
  reminderId: string;
  notificationKey: string;
}): ReminderItem | null {
  const db = readDb();
  const index = db.reminders.findIndex((item) => item.id === params.reminderId);
  if (index === -1) return null;

  const history = db.reminders[index].notificationHistory ?? [];
  if (!history.includes(params.notificationKey)) {
    history.push(params.notificationKey);
    db.reminders[index].notificationHistory = history;
  }

  writeDb(db);
  return db.reminders[index];
}

export function listConversation(sessionId?: string): StoredConversationMessage[] {
  const db = readDb();
  const messages = sessionId
    ? db.conversations.filter((message) => message.sessionId === sessionId)
    : db.conversations;

  return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
