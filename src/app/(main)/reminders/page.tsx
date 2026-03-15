"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getOrCreateSessionId } from "@/lib/client-session";
import { useLanguage } from "@/hooks/useLanguage";

type ReminderKind = "one-off" | "recurring";
type ReminderType = "appointment" | "medication" | "general";
type RecurringPattern = "daily" | "weekly";

interface ReminderItem {
  id: string;
  title: string;
  kind: ReminderKind;
  type: ReminderType;
  dueAt: string | null;
  recurringPattern: RecurringPattern | null;
  recurringTime: string | null;
  recurringWeekday: number | null;
  sourceText: string;
  status: "active" | "done";
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function RemindersPage() {
  const { t } = useLanguage();
  const [sessionId, setSessionId] = useState("");
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ReminderKind>("one-off");
  const [type, setType] = useState<ReminderType>("general");
  const [dueAt, setDueAt] = useState("");
  const [recurringPattern, setRecurringPattern] =
    useState<RecurringPattern>("daily");
  const [recurringTime, setRecurringTime] = useState("09:00");
  const [recurringWeekday, setRecurringWeekday] = useState(1);

  const [editingReminderId, setEditingReminderId] = useState<string | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editRecurringPattern, setEditRecurringPattern] =
    useState<RecurringPattern>("daily");
  const [editRecurringTime, setEditRecurringTime] = useState("09:00");

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  const loadReminders = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reminders?sessionId=${encodeURIComponent(sessionId)}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to load reminders (${response.status})`);
      }

      const data = await response.json();
      setReminders(data.reminders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const recurringReminders = useMemo(
    () =>
      reminders.filter(
        (item) => item.kind === "recurring" && item.status === "active",
      ),
    [reminders],
  );

  const oneOffReminders = useMemo(
    () =>
      reminders.filter(
        (item) => item.kind === "one-off" && item.status === "active",
      ),
    [reminders],
  );

  const doneReminders = useMemo(
    () => reminders.filter((item) => item.status === "done"),
    [reminders],
  );

  const isSaveEnabled =
    title.trim().length > 0 &&
    (kind === "one-off" ? dueAt.length > 0 : recurringTime.length > 0);

  const handleCreateReminder = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId || !title.trim()) return;

    const payload: Record<string, unknown> = {
      sessionId,
      title: title.trim(),
      type,
      kind,
      sourceText: title.trim(),
    };

    if (kind === "one-off") {
      payload.dueAt = dueAt ? new Date(dueAt).toISOString() : null;
    } else {
      payload.recurringPattern = recurringPattern;
      payload.recurringTime = recurringTime;
      if (recurringPattern === "weekly") {
        payload.recurringWeekday = recurringWeekday;
      }
    }

    const response = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setError(`Failed to create reminder (${response.status})`);
      return;
    }

    setTitle("");
    setDueAt("");
    await loadReminders();
  };

  const markDone = async (reminderId: string) => {
    const response = await fetch("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderId, action: "done" }),
    });

    if (!response.ok) {
      setError(`Failed to update reminder (${response.status})`);
      return;
    }

    await loadReminders();
  };

  const startEditing = (reminder: ReminderItem) => {
    setEditingReminderId(reminder.id);
    setEditTitle(reminder.title);
    setEditDueAt(reminder.dueAt ?? "");
    setEditRecurringPattern(reminder.recurringPattern ?? "daily");
    setEditRecurringTime(reminder.recurringTime ?? "09:00");
  };

  const cancelEditing = () => {
    setEditingReminderId(null);
    setEditTitle("");
    setEditDueAt("");
    setEditRecurringPattern("daily");
    setEditRecurringTime("09:00");
  };

  const saveEdit = async (reminder: ReminderItem) => {
    const updates: Record<string, unknown> = {
      title: editTitle.trim() || reminder.title,
    };
    if (reminder.kind === "one-off") {
      updates.dueAt = editDueAt ? new Date(editDueAt).toISOString() : null;
    } else {
      updates.recurringPattern = editRecurringPattern;
      updates.recurringTime = editRecurringTime;
    }

    const response = await fetch("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderId: reminder.id,
        action: "update",
        updates,
      }),
    });

    if (!response.ok) {
      setError(`Failed to edit reminder (${response.status})`);
      return;
    }

    cancelEditing();
    await loadReminders();
  };

  const deleteReminder = async (reminderId: string) => {
    const response = await fetch(
      `/api/reminders?reminderId=${encodeURIComponent(reminderId)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      setError(`Failed to delete reminder (${response.status})`);
      return;
    }

    await loadReminders();
  };

  return (
    <div className="h-screen bg-cream-50 pt-24 px-3 pb-24 overflow-y-auto">
      <div className="glass-heavy rounded-2xl p-6 w-[80vw] max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-navy">{t("reminders.title")}</h1>

        <form
          onSubmit={handleCreateReminder}
          className="rounded-xl bg-white/70 p-4 space-y-3"
        >
          <h2 className="text-navy font-semibold">Add Reminder</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reminder title"
              className="rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm"
              required
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReminderType)}
              className="rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm"
            >
              <option value="general">General</option>
              <option value="appointment">Appointment</option>
              <option value="medication">Medication</option>
            </select>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ReminderKind)}
              className="rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm"
            >
              <option value="one-off">One-off event</option>
              <option value="recurring">Recurring</option>
            </select>

            {kind === "one-off" ? (
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm"
                required
              />
            ) : (
              <>
                <select
                  value={recurringPattern}
                  onChange={(e) =>
                    setRecurringPattern(e.target.value as RecurringPattern)
                  }
                  className="rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <input
                  type="time"
                  value={recurringTime}
                  onChange={(e) => setRecurringTime(e.target.value)}
                  className="rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm"
                />
                {recurringPattern === "weekly" ? (
                  <select
                    value={recurringWeekday}
                    onChange={(e) =>
                      setRecurringWeekday(Number(e.target.value))
                    }
                    className="rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm sm:col-span-2"
                  >
                    {WEEKDAY_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </>
            )}
          </div>
          <button
            type="submit"
            disabled={!isSaveEnabled}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              isSaveEnabled ? "bg-pink-600" : "bg-navy/30 cursor-not-allowed"
            }`}
          >
            Save Reminder
          </button>
        </form>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-navy/60">Loading reminders...</p>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-navy">
            Recurring Reminders
          </h2>
          <ReminderList
            reminders={recurringReminders}
            onDone={markDone}
            onDelete={deleteReminder}
            onEdit={startEditing}
            editingReminderId={editingReminderId}
            editTitle={editTitle}
            editDueAt={editDueAt}
            editRecurringPattern={editRecurringPattern}
            editRecurringTime={editRecurringTime}
            onEditTitle={setEditTitle}
            onEditDueAt={setEditDueAt}
            onEditRecurringPattern={setEditRecurringPattern}
            onEditRecurringTime={setEditRecurringTime}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveEdit}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-navy">One-off Reminders</h2>
          <ReminderList
            reminders={oneOffReminders}
            onDone={markDone}
            onDelete={deleteReminder}
            onEdit={startEditing}
            editingReminderId={editingReminderId}
            editTitle={editTitle}
            editDueAt={editDueAt}
            onEditTitle={setEditTitle}
            onEditDueAt={setEditDueAt}
            onEditRecurringPattern={setEditRecurringPattern}
            onEditRecurringTime={setEditRecurringTime}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveEdit}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-navy">Completed</h2>
          <ReminderList
            reminders={doneReminders}
            onDone={markDone}
            hideDoneAction
            onDelete={deleteReminder}
            onEdit={startEditing}
            editingReminderId={editingReminderId}
            editTitle={editTitle}
            editDueAt={editDueAt}
            onEditTitle={setEditTitle}
            onEditDueAt={setEditDueAt}
            onEditRecurringPattern={setEditRecurringPattern}
            onEditRecurringTime={setEditRecurringTime}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveEdit}
          />
        </section>
      </div>

    </div>
  );
}

function ReminderList({
  reminders,
  onDone,
  onDelete,
  onEdit,
  editingReminderId,
  editTitle,
  editDueAt,
  editRecurringPattern,
  editRecurringTime,
  onEditTitle,
  onEditDueAt,
  onEditRecurringPattern,
  onEditRecurringTime,
  onSaveEdit,
  onCancelEdit,
  hideDoneAction = false,
}: {
  reminders: ReminderItem[];
  onDone: (reminderId: string) => void;
  onDelete?: (reminderId: string) => void;
  onEdit?: (reminder: ReminderItem) => void;
  editingReminderId?: string | null;
  editTitle?: string;
  editDueAt?: string;
  editRecurringPattern?: RecurringPattern;
  editRecurringTime?: string;
  onEditTitle?: (value: string) => void;
  onEditDueAt?: (value: string) => void;
  onEditRecurringPattern?: (value: RecurringPattern) => void;
  onEditRecurringTime?: (value: string) => void;
  onSaveEdit?: (reminder: ReminderItem) => void;
  onCancelEdit?: () => void;
  hideDoneAction?: boolean;
}) {
  if (reminders.length === 0) {
    return <p className="text-sm text-navy/60">No reminders yet.</p>;
  }

  return (
    <ul className="space-y-3 pr-2">
      {reminders.map((reminder) => {
        const scheduleText =
          reminder.kind === "one-off"
            ? reminder.dueAt
              ? new Date(reminder.dueAt).toLocaleString()
              : "No date/time"
            : reminder.recurringPattern === "weekly"
              ? `Weekly (${weekdayLabel(reminder.recurringWeekday)}) at ${reminder.recurringTime ?? "09:00"}`
              : `Daily at ${reminder.recurringTime ?? "09:00"}`;

        const extracted = reminder.sourceText !== reminder.title;
        const isEditing = editingReminderId === reminder.id;

        return (
          <li
            key={reminder.id}
            className="rounded-xl border border-navy/10 bg-white/80 p-3 flex flex-col gap-2"
          >
            {isEditing ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={editTitle}
                  onChange={(e) => onEditTitle?.(e.target.value)}
                  className="rounded-lg border border-navy/20 px-2 py-1"
                />
                {reminder.kind === "one-off" ? (
                  <input
                    type="datetime-local"
                    value={editDueAt}
                    onChange={(e) => onEditDueAt?.(e.target.value)}
                    className="rounded-lg border border-navy/20 px-2 py-1"
                  />
                ) : (
                  <>
                    <select
                      value={editRecurringPattern}
                      onChange={(e) =>
                        onEditRecurringPattern?.(
                          e.target.value as RecurringPattern,
                        )
                      }
                      className="rounded-lg border border-navy/20 px-2 py-1"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <input
                      type="time"
                      value={editRecurringTime}
                      onChange={(e) => onEditRecurringTime?.(e.target.value)}
                      className="rounded-lg border border-navy/20 px-2 py-1"
                    />
                  </>
                )}
                <div className="flex gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => onSaveEdit?.(reminder)}
                    className="rounded-md bg-navy px-2 py-1 text-xs text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="rounded-md border border-navy/20 px-2 py-1 text-xs text-navy"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-sm text-navy">
                    {reminder.title}
                  </p>
                  <p className="text-xs text-navy/60">{scheduleText}</p>
                  <p className="text-xs text-navy/50 mt-1">
                    {extracted
                      ? "Extracted from conversation"
                      : "Added manually"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!hideDoneAction && reminder.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => onDone(reminder.id)}
                      className="rounded-md border border-navy/20 px-2 py-1 text-xs text-navy"
                    >
                      Mark done
                    </button>
                  ) : null}
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(reminder)}
                      className="rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-700"
                    >
                      Edit
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(reminder.id)}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function weekdayLabel(value: number | null): string {
  if (value === null) return "selected day";
  const found = WEEKDAY_OPTIONS.find((item) => item.value === value);
  return found?.label ?? "selected day";
}
