import { addDays, addMonths, startOfMonth, startOfWeek } from "@/lib/time";
import type { CalendarView } from "./constants";

export type CalendarQuery = { view: CalendarView; date: string; q?: string; cat?: string };

export function calHref({ view, date, q, cat }: CalendarQuery): string {
  const p = new URLSearchParams({ view, date });
  if (q) p.set("q", q);
  if (cat) p.set("cat", cat);
  return `/calendar?${p}`;
}

/** The dates the grid for a view covers (month view always shows six full weeks). */
export function visibleRange(view: CalendarView, date: string): { from: string; to: string } {
  if (view === "day") return { from: date, to: date };
  if (view === "week") {
    const from = startOfWeek(date);
    return { from, to: addDays(from, 6) };
  }
  const from = startOfWeek(startOfMonth(date));
  return { from, to: addDays(from, 41) };
}

export function shiftDate(view: CalendarView, date: string, dir: 1 | -1): string {
  if (view === "day") return addDays(date, dir);
  if (view === "week") return addDays(date, 7 * dir);
  return addMonths(startOfMonth(date), dir);
}
