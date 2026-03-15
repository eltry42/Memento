import { NextRequest, NextResponse } from "next/server";
import { createReminder, listReminders, markReminderDone } from "@/lib/mvp-db";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? undefined;
  const reminders = listReminders(sessionId);

  return NextResponse.json({ reminders });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const {
    sessionId,
    title,
    type,
    sourceText,
    kind,
    dueAt,
    recurringPattern,
    recurringTime,
    recurringWeekday,
  } = payload;

  if (!sessionId || !title || !type || !sourceText || !kind) {
    return NextResponse.json(
      { error: "sessionId, title, type, sourceText, and kind are required" },
      { status: 400 },
    );
  }

  const reminder = createReminder({
    sessionId,
    title,
    type,
    sourceText,
    kind,
    dueAt: kind === "one-off" ? dueAt ?? null : null,
    recurringPattern: kind === "recurring" ? recurringPattern ?? "daily" : null,
    recurringTime: kind === "recurring" ? recurringTime ?? "09:00" : null,
    recurringWeekday:
      kind === "recurring" && recurringPattern === "weekly"
        ? Number(recurringWeekday ?? 1)
        : null,
  });

  return NextResponse.json({ reminder }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { reminderId } = await request.json();

  if (!reminderId) {
    return NextResponse.json(
      { error: "reminderId is required" },
      { status: 400 },
    );
  }

  const updated = markReminderDone(reminderId);

  if (!updated) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  return NextResponse.json({ reminder: updated });
}
