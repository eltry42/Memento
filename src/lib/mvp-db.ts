import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface StoredConversationMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

export interface ReminderItem {
  id: string;
  sessionId: string;
  kind: "one-off" | "recurring";
  type: "appointment" | "medication" | "general";
  title: string;
  sourceText: string;
  dueAt: string | null;
  recurringPattern: "daily" | "weekly" | null;
  recurringTime: string | null;
  recurringWeekday: number | null;
  status: "active" | "done";
  notifiedOffsets: number[];
  lastNotifiedAt: string | null;
  createdAt: string;
}

interface MementoDb {
  conversations: StoredConversationMessage[];
  reminders: ReminderItem[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "memento-db.json");

function ensureDb(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!existsSync(DB_FILE)) {
    const initialData: MementoDb = { conversations: [], reminders: [] };
    writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

function readDb(): MementoDb {
  ensureDb();
  const raw = readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw) as MementoDb;
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

function parseDueAt(sourceText: string): string | null {
  const dateTimeRegex =
    /(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?(?:\s+\d{1,2}:\d{2}\s?(?:am|pm)?)?)/i;
  const timeRegex = /(\d{1,2}:\d{2}\s?(?:am|pm)|\d{1,2}\s?(?:am|pm))/i;

  const dateMatch = sourceText.match(dateTimeRegex);
  if (dateMatch) {
    return dateMatch[1];
  }

  const timeMatch = sourceText.match(timeRegex);
  if (timeMatch) {
    return timeMatch[1];
  }

  return null;
}

export function extractReminders(params: {
  sessionId: string;
  sourceText: string;
}): ReminderItem[] {
  const text = params.sourceText.trim();
  if (!text) return [];

  const lowerText = text.toLowerCase();
  const reminders: ReminderItem[] = [];

  const hasAppointmentSignal =
    /(doctor|appointment|clinic|hospital|checkup)/i.test(lowerText);
  const hasMedicationSignal =
    /(medicine|medication|pill|tablet|take\s+my\s+med)/i.test(lowerText);
  const hasReminderSignal =
    /(remind me|don't forget|remember to|need to)/i.test(lowerText);

  if (hasAppointmentSignal) {
    reminders.push({
      id: nextId("rem"),
      sessionId: params.sessionId,
      kind: "one-off",
      type: "appointment",
      title: "Doctor appointment",
      sourceText: text,
      dueAt: parseDueAt(text),
      recurringPattern: null,
      recurringTime: null,
      recurringWeekday: null,
      status: "active",
      notifiedOffsets: [],
      lastNotifiedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  if (hasMedicationSignal) {
    reminders.push({
      id: nextId("rem"),
      sessionId: params.sessionId,
      kind: "one-off",
      type: "medication",
      title: "Medication reminder",
      sourceText: text,
      dueAt: parseDueAt(text),
      recurringPattern: null,
      recurringTime: null,
      recurringWeekday: null,
      status: "active",
      notifiedOffsets: [],
      lastNotifiedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  if (hasReminderSignal && reminders.length === 0) {
    reminders.push({
      id: nextId("rem"),
      sessionId: params.sessionId,
      kind: "one-off",
      type: "general",
      title: "General reminder",
      sourceText: text,
      dueAt: parseDueAt(text),
      recurringPattern: null,
      recurringTime: null,
      recurringWeekday: null,
      status: "active",
      notifiedOffsets: [],
      lastNotifiedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  if (reminders.length > 0) {
    const db = readDb();
    db.reminders.push(...reminders);
    writeDb(db);
  }

  return reminders;
}

export function createReminder(params: {
  sessionId: string;
  title: string;
  type: "appointment" | "medication" | "general";
  sourceText: string;
  kind: "one-off" | "recurring";
  dueAt?: string | null;
  recurringPattern?: "daily" | "weekly";
  recurringTime?: string | null;
  recurringWeekday?: number | null;
}): ReminderItem {
  const db = readDb();
  const now = new Date().toISOString();
  const reminder: ReminderItem = {
    id: nextId("rem"),
    sessionId: params.sessionId,
    kind: params.kind,
    type: params.type,
    title: params.title,
    sourceText: params.sourceText,
    dueAt: params.kind === "one-off" ? (params.dueAt ?? null) : null,
    recurringPattern:
      params.kind === "recurring" ? (params.recurringPattern ?? "daily") : null,
    recurringTime:
      params.kind === "recurring" ? (params.recurringTime ?? "09:00") : null,
    recurringWeekday:
      params.kind === "recurring" && params.recurringPattern === "weekly"
        ? (params.recurringWeekday ?? 1)
        : null,
    status: "active",
    notifiedOffsets: [],
    lastNotifiedAt: null,
    createdAt: now,
  };

  db.reminders.push(reminder);
  writeDb(db);
  return reminder;
}

export function listReminders(sessionId?: string): ReminderItem[] {
  const db = readDb();
  const reminders = sessionId
    ? db.reminders.filter((item) => item.sessionId === sessionId)
    : db.reminders;

  return reminders
    .map((item) => ({
      ...item,
      kind: item.kind ?? "one-off",
      status: item.status === "done" ? "done" : "active",
      recurringPattern: item.recurringPattern ?? null,
      recurringTime: item.recurringTime ?? null,
      recurringWeekday: item.recurringWeekday ?? null,
      notifiedOffsets: item.notifiedOffsets ?? [],
      lastNotifiedAt: item.lastNotifiedAt ?? null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateReminder(
  reminderId: string,
  updates: Partial<
    Pick<
      ReminderItem,
      | "title"
      | "type"
      | "dueAt"
      | "recurringPattern"
      | "recurringTime"
      | "recurringWeekday"
      | "kind"
    >
  >,
): ReminderItem | null {
  const db = readDb();
  const index = db.reminders.findIndex((item) => item.id === reminderId);
  if (index === -1) {
    return null;
  }

  const existing = db.reminders[index];
  const updatedReminder: ReminderItem = {
    ...existing,
    ...updates,
    notifiedOffsets:
      updates.dueAt || updates.recurringPattern || updates.recurringTime
        ? []
        : existing.notifiedOffsets,
    lastNotifiedAt:
      updates.recurringPattern || updates.recurringTime
        ? null
        : existing.lastNotifiedAt,
  };

  db.reminders[index] = updatedReminder;
  writeDb(db);
  return db.reminders[index];
}

export function deleteReminder(reminderId: string): boolean {
  const db = readDb();
  const index = db.reminders.findIndex((item) => item.id === reminderId);
  if (index === -1) return false;

  db.reminders.splice(index, 1);
  writeDb(db);
  return true;
}

export function markReminderDone(reminderId: string): ReminderItem | null {
  const db = readDb();
  const index = db.reminders.findIndex((item) => item.id === reminderId);
  if (index === -1) {
    return null;
  }

  db.reminders[index].status = "done";
  writeDb(db);
  return db.reminders[index];
}

export function listConversation(
  sessionId?: string,
): StoredConversationMessage[] {
  const db = readDb();
  const messages = sessionId
    ? db.conversations.filter((message) => message.sessionId === sessionId)
    : db.conversations;

  return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface DueReminderNotificationItem {
  reminderId: string;
  title: string;
  eventAt: string;
  scheduledFor: string;
  offsetHours: 12 | 6 | 1 | 0;
}

type ReminderSchedulingShape = Pick<
  ReminderItem,
  | "kind"
  | "dueAt"
  | "recurringPattern"
  | "recurringTime"
  | "recurringWeekday"
  | "notifiedOffsets"
  | "lastNotifiedAt"
>;

function normalizeReminderForScheduling(
  reminder: Partial<ReminderItem>,
): ReminderSchedulingShape {
  const inferredKind: ReminderItem["kind"] = reminder.kind
    ? reminder.kind
    : reminder.recurringTime || reminder.recurringPattern
      ? "recurring"
      : "one-off";

  return {
    kind: inferredKind,
    dueAt: reminder.dueAt ?? null,
    recurringPattern: reminder.recurringPattern ?? null,
    recurringTime: reminder.recurringTime ?? null,
    recurringWeekday: reminder.recurringWeekday ?? null,
    notifiedOffsets: reminder.notifiedOffsets ?? [],
    lastNotifiedAt: reminder.lastNotifiedAt ?? null,
  };
}

function isSameDay(value: string | null, compareDate: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  return (
    parsed.getFullYear() === compareDate.getFullYear() &&
    parsed.getMonth() === compareDate.getMonth() &&
    parsed.getDate() === compareDate.getDate()
  );
}

export function getDueReminderNotifications(
  sessionId: string,
  now = new Date(),
): DueReminderNotificationItem[] {
  const db = readDb();
  const notifications: DueReminderNotificationItem[] = [];

  const oneOffOffsets: Array<12 | 6 | 1 | 0> = [12, 6, 1, 0];

  for (const reminder of db.reminders) {
    const normalized = normalizeReminderForScheduling(reminder);

    if (reminder.sessionId !== sessionId) continue;
    if (reminder.status === "done") continue;

    if (normalized.kind === "one-off" && normalized.dueAt) {
      const dueDate = new Date(normalized.dueAt);
      if (Number.isNaN(dueDate.getTime())) continue;

      for (const offset of oneOffOffsets) {
        if (normalized.notifiedOffsets.includes(offset)) continue;

        const dueAtTimestamp = dueDate.getTime() - offset * 60 * 60 * 1000;
        if (now.getTime() >= dueAtTimestamp) {
          notifications.push({
            reminderId: reminder.id,
            title: reminder.title,
            eventAt: new Date(dueAtTimestamp).toISOString(),
            scheduledFor: dueDate.toISOString(),
            offsetHours: offset,
          });
          break;
        }
      }
      continue;
    }

    if (
      normalized.kind === "recurring" &&
      normalized.recurringTime &&
      reminder.status !== "done"
    ) {
      const [hours, minutes] = normalized.recurringTime.split(":").map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) continue;

      const scheduled = new Date(now);
      scheduled.setHours(hours, minutes, 0, 0);
      scheduled.setMilliseconds(0);

      if (normalized.recurringPattern === "weekly") {
        if (normalized.recurringWeekday == null) continue;
        if (scheduled.getDay() !== normalized.recurringWeekday) {
          continue;
        }
      }

      if (now.getTime() < scheduled.getTime()) continue;
      if (isSameDay(normalized.lastNotifiedAt, scheduled)) continue;

      notifications.push({
        reminderId: reminder.id,
        title: reminder.title,
        eventAt: scheduled.toISOString(),
        scheduledFor: scheduled.toISOString(),
        offsetHours: 0,
      });
    }
  }

  return notifications.sort((a, b) => {
    const timeDiff =
      new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.offsetHours - b.offsetHours;
  });
}

export function markReminderNotified(
  reminderId: string,
  offsetHours: 12 | 6 | 1 | 0 | null,
  notifiedAt?: string,
): ReminderItem | null {
  const db = readDb();
  const index = db.reminders.findIndex((item) => item.id === reminderId);
  if (index === -1) return null;

  const reminder = db.reminders[index];

  if (offsetHours !== null && reminder.kind === "one-off") {
    const offsets = new Set(reminder.notifiedOffsets ?? []);
    offsets.add(offsetHours);
    reminder.notifiedOffsets = Array.from(offsets).sort((a, b) => a - b);
  } else {
    reminder.lastNotifiedAt = notifiedAt ?? new Date().toISOString();
  }

  db.reminders[index] = reminder;
  writeDb(db);
  return reminder;
}
