import { NextRequest, NextResponse } from "next/server";
import {
  createReminder,
  deleteReminder,
  getDueReminderNotifications,
  listReminders,
  markReminderDone,
  markReminderNotificationSent,
  ReminderKind,
  ReminderType,
  RecurringPattern,
} from "@/lib/mvp-db";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? undefined;
  const dueOnly = request.nextUrl.searchParams.get("dueOnly") === "true";
  const markNotified = request.nextUrl.searchParams.get("markNotified") === "true";

  if (dueOnly) {
    const notifications = getDueReminderNotifications({ sessionId });

    if (markNotified) {
      notifications.forEach((item) => {
        markReminderNotificationSent({
          reminderId: item.reminderId,
          notificationKey: item.notificationKey,
        });
      });
    }

    return NextResponse.json({ notifications });
  }

  const reminders = listReminders(sessionId);
  return NextResponse.json({ reminders });
}

async function createReminderFromRequest(request: NextRequest) {
  const body = await request.json();
  const sessionId = body.sessionId as string | undefined;
  const title = body.title as string | undefined;
  const kind = body.kind as ReminderKind | undefined;

  if (!sessionId || !title || !kind) {
    return NextResponse.json(
      { error: "sessionId, title and kind are required" },
      { status: 400 },
    );
  }

  if (kind === "one-off" && !body.dueAt) {
    return NextResponse.json(
      { error: "dueAt is required for one-off reminders" },
      { status: 400 },
    );
  }

  if (kind === "recurring" && !body.recurringPattern) {
    return NextResponse.json(
      { error: "recurringPattern is required for recurring reminders" },
      { status: 400 },
    );
  }

  const reminder = createReminder({
    sessionId,
    title,
    type: (body.type as ReminderType | undefined) ?? "general",
    kind,
    dueAt: (body.dueAt as string | undefined) ?? null,
    recurringPattern: (body.recurringPattern as RecurringPattern | undefined) ?? null,
    recurringTime: (body.recurringTime as string | undefined) ?? null,
    recurringWeekday:
      typeof body.recurringWeekday === "number" ? body.recurringWeekday : null,
    sourceText: (body.sourceText as string | undefined) ?? title,
  });

  return NextResponse.json({ reminder }, { status: 201 });
}

export async function POST(request: NextRequest) {
  return createReminderFromRequest(request);
}

// MVP compatibility: some clients/environments call PUT for create actions.
export async function PUT(request: NextRequest) {
  return createReminderFromRequest(request);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    },
  });
}

export async function DELETE(request: NextRequest) {
  const { reminderId } = await request.json();

  if (!reminderId) {
    return NextResponse.json(
      { error: "reminderId is required" },
      { status: 400 },
    );
  }

  const reminders = listReminders();
  const target = reminders.find((item) => item.id === reminderId);
  if (!target) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  if (target.status !== "done") {
    return NextResponse.json(
      { error: "Only completed reminders can be deleted" },
      { status: 400 },
    );
  }

  const removed = deleteReminder(reminderId);
  if (!removed) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  return NextResponse.json({ reminder: removed });
}

export async function PATCH(request: NextRequest) {
  const { reminderId, action, notificationKey } = await request.json();

  if (!reminderId) {
    return NextResponse.json(
      { error: "reminderId is required" },
      { status: 400 },
    );
  }

  if (action === "notified") {
    if (!notificationKey) {
      return NextResponse.json(
        { error: "notificationKey is required for notified action" },
        { status: 400 },
      );
    }

    const notified = markReminderNotificationSent({ reminderId, notificationKey });
    if (!notified) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    return NextResponse.json({ reminder: notified });
  }

  const updated = markReminderDone(reminderId);
  if (!updated) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  return NextResponse.json({ reminder: updated });
}
