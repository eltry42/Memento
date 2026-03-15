import { NextRequest, NextResponse } from "next/server";
import {
  createReminder,
  deleteReminder,
  getDueReminderNotifications,
  listReminders,
  markReminderDone,
  markReminderNotified,
  updateReminder,
} from "@/lib/mvp-db";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? undefined;
  const dueOnly = request.nextUrl.searchParams.get("dueOnly") === "true";
  const markNotified =
    request.nextUrl.searchParams.get("markNotified") === "true";

  if (dueOnly && sessionId) {
    const dueReminders = getDueReminderNotifications(sessionId);

    if (markNotified) {
      dueReminders.forEach((notification) => {
        markReminderNotified(
          notification.reminderId,
          notification.offsetHours,
          notification.eventAt,
        );
      });
    }

    const notifications = dueReminders.map((r) => ({
      reminderId: r.reminderId,
      title: r.title,
      eventAt: r.eventAt,
      scheduledFor: r.scheduledFor,
      offsetHours: r.offsetHours,
    }));

    return NextResponse.json({ notifications });
  }

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
    dueAt,
    recurringPattern,
    recurringTime,
    recurringWeekday,
  });

  return NextResponse.json({ reminder }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const payload = await request.json();
  const { reminderId, action, updates } = payload;

  if (!reminderId) {
    return NextResponse.json(
      { error: "reminderId is required" },
      { status: 400 },
    );
  }

  if (action === "done") {
    const updated = markReminderDone(reminderId);
    if (!updated) {
      return NextResponse.json(
        { error: "Reminder not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ reminder: updated });
  }

  if (action === "update") {
    const updated = updateReminder(reminderId, updates ?? {});
    if (!updated) {
      return NextResponse.json(
        { error: "Reminder not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ reminder: updated });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const reminderId =
    request.nextUrl.searchParams.get("reminderId") ?? undefined;
  if (!reminderId) {
    return NextResponse.json(
      { error: "reminderId is required" },
      { status: 400 },
    );
  }

  const deleted = deleteReminder(reminderId);
  if (!deleted) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
