import { cache } from "react";
import { expandEvents } from "@/features/calendar/recurrence";
import {
  noClassToItems,
  occurrenceToItem,
  sessionToItem,
  type SessionForCalendar,
} from "@/features/calendar/items";
import type { CalendarEvent, CalendarItem, EventException } from "@/features/calendar/types";
import type { RepeatFreq, EventCategory } from "@/features/calendar/constants";
import { trimTime } from "@/features/classes/rules";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "./teacher";

type EventRow = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  color: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  notes: string;
  reminder_minutes: number | null;
  repeat_freq: RepeatFreq;
  repeat_interval: number;
  repeat_until: string | null;
};
const EVENT_COLS =
  "id, title, description, category, color, start_date, end_date, start_time, end_time, location, notes, reminder_minutes, repeat_freq, repeat_interval, repeat_until";

const toEvent = (r: EventRow): CalendarEvent => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  color: r.color,
  startDate: r.start_date,
  endDate: r.end_date,
  startTime: r.start_time ? trimTime(r.start_time) : null,
  endTime: r.end_time ? trimTime(r.end_time) : null,
  location: r.location,
  notes: r.notes,
  reminderMinutes: r.reminder_minutes,
  repeatFreq: r.repeat_freq,
  repeatInterval: r.repeat_interval,
  repeatUntil: r.repeat_until,
});

type ExceptionRow = {
  event_id: string;
  occurrence_date: string;
  cancelled: boolean;
  title: string | null;
  description: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  notes: string;
};
const EXC_COLS =
  "event_id, occurrence_date, cancelled, title, description, start_date, end_date, start_time, end_time, location, notes";

const toException = (r: ExceptionRow): EventException => ({
  eventId: r.event_id,
  occurrenceDate: r.occurrence_date,
  cancelled: r.cancelled,
  title: r.title,
  description: r.description,
  startDate: r.start_date,
  endDate: r.end_date,
  startTime: r.start_time ? trimTime(r.start_time) : null,
  endTime: r.end_time ? trimTime(r.end_time) : null,
  location: r.location,
  notes: r.notes,
});

const fail = (what: string) => new Error(`Could not load ${what}.`);
const chunk = <T>(arr: T[], n = 100) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/** Everything drawn on the calendar between two dates (inclusive). */
export const getCalendarItems = cache(async (from: string, to: string): Promise<CalendarItem[]> => {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  // Events that start before the range ends and still run (or repeat) into it.
  const [eventsRes, movedRes, sessionsRes, daysRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select(EVENT_COLS)
      .eq("user_id", teacher.id)
      .lte("start_date", to)
      .or(`end_date.gte.${from},repeat_until.gte.${from}`)
      .limit(1000),
    // Occurrences moved into the range from a series that otherwise would not be loaded.
    supabase
      .from("calendar_event_exceptions")
      .select(EXC_COLS)
      .eq("user_id", teacher.id)
      .eq("cancelled", false)
      .lte("start_date", to)
      .gte("end_date", from)
      .limit(1000),
    supabase
      .from("teaching_sessions")
      .select("id, subject_id, section_id, origin, session_date, start_time, end_time, status")
      .eq("user_id", teacher.id)
      .gte("session_date", from)
      .lte("session_date", to)
      .order("session_date")
      .limit(1000),
    supabase
      .from("no_class_days")
      .select("id, date_from, date_to, reason")
      .eq("user_id", teacher.id)
      .lte("date_from", to)
      .gte("date_to", from),
  ]);
  if (eventsRes.error) throw fail("your events");
  if (movedRes.error) throw fail("your events");
  if (sessionsRes.error) throw fail("your teaching sessions");
  if (daysRes.error) throw fail("your no-class days");

  const events = new Map<string, CalendarEvent>();
  for (const r of (eventsRes.data ?? []) as EventRow[]) events.set(r.id, toEvent(r));

  const moved = ((movedRes.data ?? []) as ExceptionRow[]).filter((x) => !events.has(x.event_id));
  const missingIds = [...new Set(moved.map((x) => x.event_id))];
  for (const ids of chunk(missingIds)) {
    const res = await supabase
      .from("calendar_events")
      .select(EVENT_COLS)
      .eq("user_id", teacher.id)
      .in("id", ids);
    if (res.error) throw fail("your events");
    for (const r of (res.data ?? []) as EventRow[]) events.set(r.id, toEvent(r));
  }

  const repeatingIds = [...events.values()].filter((e) => e.repeatFreq !== "none").map((e) => e.id);
  const exceptions: EventException[] = [];
  for (const ids of chunk(repeatingIds)) {
    const res = await supabase
      .from("calendar_event_exceptions")
      .select(EXC_COLS)
      .eq("user_id", teacher.id)
      .in("event_id", ids);
    if (res.error) throw fail("your events");
    exceptions.push(...((res.data ?? []) as ExceptionRow[]).map(toException));
  }

  const items: CalendarItem[] = expandEvents([...events.values()], exceptions, from, to).map((o) =>
    occurrenceToItem(o, events.get(o.eventId)!),
  );

  // Teaching sessions: names come from subjects / sections (kept per academic year).
  type SessionRow = {
    id: string;
    subject_id: string;
    section_id: string;
    origin: SessionForCalendar["origin"];
    session_date: string;
    start_time: string;
    end_time: string;
    status: string;
  };
  const sessions = (sessionsRes.data ?? []) as SessionRow[];
  const names = async (table: "subjects" | "class_sections", ids: string[]) => {
    const map = new Map<string, string>();
    for (const part of chunk([...new Set(ids)])) {
      const res = await supabase
        .from(table)
        .select("id, name")
        .eq("user_id", teacher.id)
        .in("id", part);
      if (res.error) throw fail("your classes");
      for (const r of res.data ?? []) map.set(r.id as string, r.name as string);
    }
    return map;
  };
  const [subjectNames, sectionNames] = await Promise.all([
    names(
      "subjects",
      sessions.map((s) => s.subject_id),
    ),
    names(
      "class_sections",
      sessions.map((s) => s.section_id),
    ),
  ]);
  for (const s of sessions) {
    items.push(
      sessionToItem({
        id: s.id,
        subjectName: subjectNames.get(s.subject_id) ?? "Subject",
        sectionName: sectionNames.get(s.section_id) ?? "Section",
        origin: s.origin,
        date: s.session_date,
        startTime: trimTime(s.start_time),
        endTime: trimTime(s.end_time),
        status: s.status,
      }),
    );
  }

  for (const d of (daysRes.data ?? []) as {
    id: string;
    date_from: string;
    date_to: string;
    reason: string;
  }[]) {
    items.push(
      noClassToItems({ id: d.id, dateFrom: d.date_from, dateTo: d.date_to, reason: d.reason }),
    );
  }
  return items;
});

/** Text search across all of the teacher's events (series definitions), newest first. */
export async function searchEvents(
  query: string,
  category: string | null,
): Promise<CalendarEvent[]> {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  // Characters with a meaning inside PostgREST filters are removed rather than escaped.
  const safe = query.replace(/[%*,()\\"]/g, " ").trim();
  if (!safe) return [];
  let q = supabase
    .from("calendar_events")
    .select(EVENT_COLS)
    .eq("user_id", teacher.id)
    .or(
      `title.ilike.%${safe}%,description.ilike.%${safe}%,location.ilike.%${safe}%,notes.ilike.%${safe}%`,
    )
    .order("start_date", { ascending: false })
    .limit(50);
  if (category) q = q.eq("category", category);
  const res = await q;
  if (res.error) throw fail("your events");
  return ((res.data ?? []) as EventRow[]).map(toEvent);
}
