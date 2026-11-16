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
