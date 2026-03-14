import { NextRequest, NextResponse } from "next/server";
import { listReminders, markReminderDone } from "@/lib/mvp-db";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? undefined;
  const reminders = listReminders(sessionId);

  return NextResponse.json({ reminders });
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
