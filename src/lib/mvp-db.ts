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
  type: "appointment" | "medication" | "general";
  title: string;
  sourceText: string;
  dueAt: string | null;
  recurringPattern: "daily" | "weekly" | null;
  recurringTime: string | null;
  recurringWeekday: number | null;
  status: "active" | "done";
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
  if (!raw.trim()) {
    const initialData: MementoDb = { conversations: [], reminders: [] };
    writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
    return initialData;
  }

  try {
    return JSON.parse(raw) as MementoDb;
  } catch {
    const initialData: MementoDb = { conversations: [], reminders: [] };
    writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
    return initialData;
  }
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

  const hasAppointmentSignal = /(doctor|appointment|clinic|hospital|checkup)/i.test(
    lowerText,
  );
  const hasMedicationSignal = /(medicine|medication|pill|tablet|take\s+my\s+med)/i.test(
    lowerText,
  );
  const hasReminderSignal = /(remind me|don't forget|remember to|need to)/i.test(
    lowerText,
  );

  if (hasAppointmentSignal) {
    reminders.push({
      id: nextId("rem"),
      sessionId: params.sessionId,
      type: "appointment",
      title: "Doctor appointment",
      sourceText: text,
      dueAt: parseDueAt(text),
      recurringPattern: null,
      recurringTime: null,
      recurringWeekday: null,
      status: "active",
      createdAt: new Date().toISOString(),
    });
  }

  if (hasMedicationSignal) {
    reminders.push({
      id: nextId("rem"),
      sessionId: params.sessionId,
      type: "medication",
      title: "Medication reminder",
      sourceText: text,
      dueAt: parseDueAt(text),
      recurringPattern: null,
      recurringTime: null,
      recurringWeekday: null,
      status: "active",
      createdAt: new Date().toISOString(),
    });
  }

  if (hasReminderSignal && reminders.length === 0) {
    reminders.push({
      id: nextId("rem"),
      sessionId: params.sessionId,
      type: "general",
      title: "General reminder",
      sourceText: text,
      dueAt: parseDueAt(text),
      recurringPattern: null,
      recurringTime: null,
      recurringWeekday: null,
      status: "active",
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
  recurringPattern?: "daily" | "weekly" | null;
  recurringTime?: string | null;
  recurringWeekday?: number | null;
}): ReminderItem {
  const db = readDb();
  const now = new Date().toISOString();
  const reminder: ReminderItem = {
    id: nextId("rem"),
    sessionId: params.sessionId,
    type: params.type,
    title: params.title,
    sourceText: params.sourceText,
    dueAt: params.kind === "one-off" ? params.dueAt ?? null : null,
    recurringPattern: params.kind === "recurring" ? params.recurringPattern ?? "daily" : null,
    recurringTime: params.kind === "recurring" ? params.recurringTime ?? "09:00" : null,
    recurringWeekday:
      params.kind === "recurring" && params.recurringPattern === "weekly"
        ? params.recurringWeekday ?? 1
        : null,
    status: "active",
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

  return reminders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

export function listConversation(sessionId?: string): StoredConversationMessage[] {
  const db = readDb();
  const messages = sessionId
    ? db.conversations.filter((message) => message.sessionId === sessionId)
    : db.conversations;

  return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
