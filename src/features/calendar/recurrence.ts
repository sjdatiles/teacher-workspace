import { addDays, addMonths, daysBetween } from "@/lib/time";
import type { CalendarEvent, EventException, EventOccurrence } from "./types";

type Series = Pick<
  CalendarEvent,
  "startDate" | "endDate" | "repeatFreq" | "repeatInterval" | "repeatUntil"
>;

const MAX_OCCURRENCES = 1100; // a 2-year daily series is 732

/**
 * Every date a series normally starts on, in order.
 *  - daily / weekly step by interval days / weeks from the first date
 *  - monthly keeps the day of the month; a month without that day uses its last day
 */
export function allOccurrenceStarts(s: Series): string[] {
  if (s.repeatFreq === "none" || !s.repeatUntil) return [s.startDate];
  const out: string[] = [];
  const step = Math.max(1, s.repeatInterval);
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const d =
      s.repeatFreq === "daily"
        ? addDays(s.startDate, n * step)
        : s.repeatFreq === "weekly"
          ? addDays(s.startDate, n * step * 7)
          : addMonths(s.startDate, n * step);
    if (d > s.repeatUntil) break;
    out.push(d);
  }
  return out;
}

const overlaps = (start: string, end: string, from: string, to: string) =>
  start <= to && end >= from;

/**
 * Turns stored events into the occurrences visible in [from, to].
 * Skipped occurrences are left out; changed ones use their own date, time and text.
 * An exception that no longer matches a real occurrence (series shortened) is ignored.
 */
export function expandEvents(
  events: CalendarEvent[],
  exceptions: EventException[],
  from: string,
  to: string,
): EventOccurrence[] {
  const byEvent = new Map<string, Map<string, EventException>>();
  for (const x of exceptions) {
    if (!byEvent.has(x.eventId)) byEvent.set(x.eventId, new Map());
    byEvent.get(x.eventId)!.set(x.occurrenceDate, x);
  }

  const out: EventOccurrence[] = [];
  for (const e of events) {
    const span = daysBetween(e.startDate, e.endDate);
    const ex = byEvent.get(e.id);
    for (const start of allOccurrenceStarts(e)) {
      const x = ex?.get(start);
      if (x) {
        if (x.cancelled || !x.title || !x.startDate || !x.endDate) continue;
        if (!overlaps(x.startDate, x.endDate, from, to)) continue;
        out.push({
          eventId: e.id,
          occurrenceDate: start,
          title: x.title,
          description: x.description,
          location: x.location,
          notes: x.notes,
          startDate: x.startDate,
          endDate: x.endDate,
          startTime: x.startTime,
          endTime: x.endTime,
          changed: true,
        });
        continue;
      }
      const end = addDays(start, span);
      if (!overlaps(start, end, from, to)) continue;
      out.push({
        eventId: e.id,
        occurrenceDate: start,
        title: e.title,
        description: e.description,
        location: e.location,
        notes: e.notes,
        startDate: start,
        endDate: end,
        startTime: e.startTime,
        endTime: e.endTime,
        changed: false,
      });
    }
  }
  return out;
}

/** The dates a repeating event covers, for showing "Repeats weekly until …". */
export function describeRepeat(
  e: Pick<CalendarEvent, "repeatFreq" | "repeatInterval" | "repeatUntil">,
): string {
  if (e.repeatFreq === "none" || !e.repeatUntil) return "Does not repeat";
  const unit = { daily: "day", weekly: "week", monthly: "month" }[e.repeatFreq];
  return e.repeatInterval === 1 ? `Every ${unit}` : `Every ${e.repeatInterval} ${unit}s`;
}
