import { formatTime } from "@/features/classes/rules";
import type { CalendarItem } from "@/features/calendar/types";
import { addDays, daysBetween, formatDate } from "@/lib/time";

export type NotificationKind = "session" | "event" | "deadline" | "overdue";

export type AppNotification = {
  /** Stable id, so "read" and "dismissed" survive reloads: 'task-overdue:<id>', 'event:<id>:<date>'... */
  key: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string;
  /** Minutes from the start of today; used only for ordering (earliest / most overdue first). */
  order: number;
};

export type Prefs = { upcomingSessions: boolean; upcomingEvents: boolean; taskDeadlines: boolean };
export type Now = { date: string; minutes: number };
export type DueTask = { id: string; title: string; dueDate: string; priority: string };

export const MAX_OVERDUE_SHOWN = 10;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** Minutes from the start of `now.date` to a date and time. */
const at = (now: Now, date: string, hhmm: string | null, endOfDay = false) =>
  daysBetween(now.date, date) * 1440 + (hhmm ? toMinutes(hhmm) : endOfDay ? 1440 : 0);

function dayWord(now: Now, date: string): string {
  const d = daysBetween(now.date, date);
  return d === 0 ? "today" : d === 1 ? "tomorrow" : formatDate(date);
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Works out which notifications apply right now. Pure: the same records and the same clock always give
 * the same list. Teachers control the three groups in Settings → Notifications.
 *
 * - Sessions: Scheduled sessions today (not yet ended) or tomorrow.
 * - Events: only events that have a reminder; shown from the reminder time until the event ends.
 * - Task deadlines: open tasks due today or tomorrow. Overdue: open tasks past their due date.
 */
export function buildNotifications(
  items: CalendarItem[],
  tasks: DueTask[],
  prefs: Prefs,
  now: Now,
): AppNotification[] {
  const out: AppNotification[] = [];
  const tomorrow = addDays(now.date, 1);

  if (prefs.upcomingSessions) {
    for (const i of items) {
      if (
        i.kind !== "session" ||
        i.status !== "scheduled" ||
        !i.sessionId ||
        !i.startTime ||
        !i.endTime
      )
        continue;
      if (i.startDate !== now.date && i.startDate !== tomorrow) continue;
      if (i.startDate === now.date && at(now, i.startDate, i.endTime) <= now.minutes) continue;
      out.push({
        key: `session:${i.sessionId}`,
        kind: "session",
        title: `${i.title} · ${i.subtitle}`,
        message: `${cap(dayWord(now, i.startDate))}, ${formatTime(i.startTime)} – ${formatTime(i.endTime)}`,
        href: `/calendar?view=day&date=${i.startDate}`,
        order: at(now, i.startDate, i.startTime),
      });
    }
  }

  if (prefs.upcomingEvents) {
    for (const i of items) {
      const reminder = i.event?.reminderMinutes;
      if (i.kind !== "event" || reminder === null || reminder === undefined || !i.occurrence)
        continue;
      const start = at(now, i.startDate, i.startTime);
      const end = at(now, i.endDate, i.endTime, true);
      if (now.minutes < start - reminder || now.minutes >= end) continue;
      const message =
        now.minutes >= start
          ? i.startTime
            ? "Happening now"
            : "All day today"
          : i.startTime
            ? `Starts ${dayWord(now, i.startDate)} at ${formatTime(i.startTime)}`
            : `All day ${dayWord(now, i.startDate)}`;
      out.push({
        key: i.key,
        kind: "event",
        title: i.title,
        message,
        href: `/calendar?view=day&date=${i.startDate < now.date ? now.date : i.startDate}`,
        order: start,
      });
    }
  }

  if (prefs.taskDeadlines) {
    const overdue = tasks
      .filter((t) => t.dueDate < now.date)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const t of overdue.slice(0, MAX_OVERDUE_SHOWN)) {
      const days = daysBetween(t.dueDate, now.date);
      out.push({
        key: `task-overdue:${t.id}`,
        kind: "overdue",
        title: t.title,
        message: `Overdue by ${days} ${days === 1 ? "day" : "days"} (was due ${formatDate(t.dueDate)})`,
        href: "/tasks?due=overdue",
        order: at(now, t.dueDate, null) - 1440 * 1000,
      });
    }
    for (const t of tasks) {
      if (t.dueDate !== now.date && t.dueDate !== tomorrow) continue;
      out.push({
        key: `task-due:${t.id}:${t.dueDate}`,
        kind: "deadline",
        title: t.title,
        message: `Due ${dayWord(now, t.dueDate)}`,
        href: "/tasks",
        order: at(now, t.dueDate, null),
      });
    }
  }

  return out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
