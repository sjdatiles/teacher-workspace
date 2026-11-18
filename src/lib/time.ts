/**
 * Calendar dates are handled as ISO strings ("YYYY-MM-DD") so they never shift with
 * time zones. "Today" is evaluated in the teacher's school time zone (Philippines).
 * A per-teacher time-zone setting can replace this constant later without other changes.
 */
export const SCHOOL_TIME_ZONE = "Asia/Manila";

/** Today's date in the school time zone, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True only for real calendar dates in YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "Jun 1, 2026" — formatted from the ISO string with no time-zone shift. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatRange(startISO: string, endISO: string): string {
  return `${formatDate(startISO)} – ${formatDate(endISO)}`;
}

// ---------------------------------------------------------------------------
// Date arithmetic on ISO strings (UTC math, so no time-zone or DST drift)
// ---------------------------------------------------------------------------
const MS_DAY = 86_400_000;
const toUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) =>
  fromUTC(new Date(toUTC(iso).getTime() + n * MS_DAY));

/** Whole days from a to b (b - a). */
export const daysBetween = (a: string, b: string) =>
  Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / MS_DAY);

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: string): number {
  const d = toUTC(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

export const startOfWeek = (iso: string) => addDays(iso, 1 - isoWeekday(iso));
export const startOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

export function endOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return fromUTC(new Date(Date.UTC(y, m, 0)));
}

/**
 * Adds whole months. If the target month has no such day (31st → February) the last day of
 * that month is used, e.g. addMonths("2026-01-31", 1) = "2026-02-28".
 */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return fromUTC(
    new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))),
  );
}

/** "December 2026" */
export function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(toUTC(iso));
}

/** "Mon" */
export function weekdayShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(toUTC(iso));
}

/** "Monday, Dec 7, 2026" */
export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(toUTC(iso));
}

/** Day of month as a number. */
export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));

/** The current date and minutes since midnight in the school time zone. */
export function nowInSchool(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { date: todayISO(now), minutes: (num("hour") % 24) * 60 + num("minute") };
}
