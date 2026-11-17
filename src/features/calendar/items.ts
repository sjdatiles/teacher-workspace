import { DEFAULT_COLOR, categoryLabel, type DisplayCategory } from "./constants";
import { formatTimeRange } from "@/features/classes/rules";
import { statusMeta } from "@/features/classes/constants";
import type { CalendarEvent, CalendarItem, EventOccurrence } from "./types";

export function occurrenceToItem(o: EventOccurrence, e: CalendarEvent): CalendarItem {
  return {
    key: `event:${o.eventId}:${o.occurrenceDate}`,
    kind: "event",
    title: o.title,
    subtitle: o.location || categoryLabel(e.category),
    startDate: o.startDate,
    endDate: o.endDate,
    startTime: o.startTime,
    endTime: o.endTime,
    category: e.category,
    color: e.color ?? DEFAULT_COLOR[e.category],
    occurrence: o,
    event: e,
  };
}

export type SessionForCalendar = {
  id: string;
  subjectName: string;
  sectionName: string;
  origin: "generated" | "manual" | "rescheduled";
  date: string;
  startTime: string;
  endTime: string;
  status: string;
};

export function sessionToItem(s: SessionForCalendar): CalendarItem {
  const category: DisplayCategory =
    s.origin === "generated" ? "teaching_schedule" : "teaching_session";
  const status = statusMeta(s.status);
  return {
    key: `session:${s.id}`,
    kind: "session",
    title: s.subjectName,
    subtitle: s.status === "scheduled" ? s.sectionName : `${s.sectionName} · ${status.label}`,
    startDate: s.date,
    endDate: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    category,
    color: DEFAULT_COLOR[category],
    status: s.status,
    sessionId: s.id,
  };
}

export function noClassToItems(d: {
  id: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
}): CalendarItem {
  return {
    key: `noclass:${d.id}`,
    kind: "noclass",
    title: d.reason || "No class",
    subtitle: "No class",
    startDate: d.dateFrom,
    endDate: d.dateTo,
    startTime: null,
    endTime: null,
    category: "noclass",
    color: "gray",
  };
}

/** Items on one date: all-day / multi-day first, then by start time. */
export function itemsOnDate(items: CalendarItem[], date: string): CalendarItem[] {
  return items
    .filter((i) => i.startDate <= date && i.endDate >= date)
    .sort((a, b) => {
      const rank = (i: CalendarItem) => (i.kind === "noclass" ? 0 : i.startTime === null ? 1 : 2);
      return (
        rank(a) - rank(b) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.title.localeCompare(b.title)
      );
    });
}

/** "2:00 PM – 3:30 PM", or "All day". */
export function itemTimeLabel(i: CalendarItem): string {
  return i.startTime && i.endTime ? formatTimeRange(i.startTime, i.endTime) : "All day";
}
