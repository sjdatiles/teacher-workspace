import { isValidISODate } from "@/lib/time";
import type { Term } from "@/features/academic/rules";
import { GRADE_LEVELS } from "./constants";
import type { Schedule } from "./types";

/**
 * My Classes rules. They mirror the database checks so teachers get precise messages
 * before saving; the database stays the final authority (see supabase/migrations).
 */

export type Errors = Record<string, string>;
export type YearBounds = { startDate: string; endDate: string; terms: Term[] };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isGrade = (v: string) => (GRADE_LEVELS as readonly string[]).includes(v);

/** Minutes since midnight for "HH:MM" (also accepts "HH:MM:SS"). */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** "08:00:00" → "08:00" */
export const trimTime = (t: string) => t.slice(0, 5);

/** "13:30" → "1:30 PM" */
export function formatTime(t: string): string {
  const mins = timeToMinutes(t);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const formatTimeRange = (start: string, end: string) =>
  `${formatTime(start)} – ${formatTime(end)}`;

/** 90 → "1 h 30 min", 60 → "1 h", 45 → "45 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Hours with up to 2 decimals: 150 → "2.5" */
export const formatHours = (minutes: number) => String(Math.round((minutes / 60) * 100) / 100);

/** The term of the year that contains a date, if any. */
export function termForDate(date: string, terms: Term[]): Term | null {
  return terms.find((t) => date >= t.startDate && date <= t.endDate) ?? null;
}

// ---------------------------------------------------------------------------
// Subject / section
// ---------------------------------------------------------------------------
export function validateSubject(i: {
  name: string;
  code: string;
  gradeLevel: string;
  description: string;
}): Errors {
  const e: Errors = {};
  const name = i.name.trim();
  if (!name) e.name = "Enter the subject name.";
  else if (name.length > 80) e.name = "Use 80 characters or fewer.";
  if (i.code.trim().length > 20) e.code = "Use 20 characters or fewer.";
  if (!isGrade(i.gradeLevel)) e.gradeLevel = "Choose a grade level.";
  if (i.description.trim().length > 500) e.description = "Use 500 characters or fewer.";
  return e;
}

export function validateSection(i: {
  name: string;
  gradeLevel: string;
  population: string;
  description: string;
}): Errors {
  const e: Errors = {};
  const name = i.name.trim();
  if (!name) e.name = "Enter the section name.";
  else if (name.length > 80) e.name = "Use 80 characters or fewer.";
  if (!isGrade(i.gradeLevel)) e.gradeLevel = "Choose a grade level.";
  const pop = i.population.trim();
  if (pop === "") e.population = "Enter the number of enrolled students.";
  else if (!/^\d+$/.test(pop)) e.population = "Enter a whole number, 0 or more.";
  else if (Number(pop) > 200) e.population = "A section can have at most 200 students.";
  if (i.description.trim().length > 500) e.description = "Use 500 characters or fewer.";
  return e;
}

// ---------------------------------------------------------------------------
// Time ranges
// ---------------------------------------------------------------------------
function validateTimes(e: Errors, start: string, end: string) {
  if (!TIME.test(start)) e.startTime = "Choose the start time.";
  if (!TIME.test(end)) e.endTime = "Choose the end time.";
  if (!e.startTime && !e.endTime && timeToMinutes(end) <= timeToMinutes(start)) {
    e.endTime = "The end time must be after the start time.";
  }
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------
export type ScheduleInput = {
  subjectId: string;
  sectionId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveStart: string;
  effectiveEnd: string;
  termNumbers: number[];
};

export function validateSchedule(i: ScheduleInput, year: YearBounds | null): Errors {
  const e: Errors = {};
  if (!i.subjectId) e.subjectId = "Choose a subject.";
  if (!i.sectionId) e.sectionId = "Choose a section.";
  if (!Number.isInteger(i.dayOfWeek) || i.dayOfWeek < 1 || i.dayOfWeek > 7)
    e.dayOfWeek = "Choose a day of the week.";
  validateTimes(e, i.startTime, i.endTime);

  if (!i.effectiveStart) e.effectiveStart = "Choose the first day of this schedule.";
  else if (!isValidISODate(i.effectiveStart)) e.effectiveStart = "That is not a valid date.";
  if (!i.effectiveEnd) e.effectiveEnd = "Choose the last day of this schedule.";
  else if (!isValidISODate(i.effectiveEnd)) e.effectiveEnd = "That is not a valid date.";
  if (!e.effectiveStart && !e.effectiveEnd && i.effectiveStart > i.effectiveEnd)
    e.effectiveEnd = "The last day must not be before the first day.";
  if (year) {
    if (!e.effectiveStart && i.effectiveStart < year.startDate)
      e.effectiveStart = "This is before the academic year starts.";
    if (!e.effectiveEnd && i.effectiveEnd > year.endDate)
      e.effectiveEnd = "This is after the academic year ends.";
  }

  const terms = new Set(i.termNumbers);
  if (terms.size === 0 || [...terms].some((n) => ![1, 2, 3].includes(n)))
    e.termNumbers = "Choose at least one term.";
  return e;
}

export type ScheduleConflicts = {
  /** Same subject, section, day and time already scheduled in the same period: refused. */
  duplicates: Schedule[];
  /** Different class at an overlapping time on the same day: warned, may be saved anyway. */
  overlaps: Schedule[];
};

const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart <= bEnd && bStart <= aEnd;

/**
 * Finds schedules that clash with a candidate. A clash needs the same weekday, overlapping
 * time, overlapping effective dates and at least one term in common.
 */
export function findScheduleConflicts(
  candidate: ScheduleInput,
  existing: Schedule[],
  ignoreId?: string,
): ScheduleConflicts {
  const out: ScheduleConflicts = { duplicates: [], overlaps: [] };
  const cs = timeToMinutes(candidate.startTime);
  const ce = timeToMinutes(candidate.endTime);

  for (const s of existing) {
    if (s.id === ignoreId) continue;
    if (s.dayOfWeek !== candidate.dayOfWeek) continue;
    if (
      !rangesOverlap(
        s.effectiveStart,
        s.effectiveEnd,
        candidate.effectiveStart,
        candidate.effectiveEnd,
      )
    )
      continue;
    if (!s.termNumbers.some((n) => candidate.termNumbers.includes(n))) continue;

    const same = s.subjectId === candidate.subjectId && s.sectionId === candidate.sectionId;
    if (same && s.startTime === candidate.startTime && s.endTime === candidate.endTime) {
      out.duplicates.push(s);
      continue;
    }
    // Times overlap when each starts before the other ends.
    if (timeToMinutes(s.startTime) < ce && cs < timeToMinutes(s.endTime)) out.overlaps.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
export type ManualSessionInput = {
  subjectId: string;
  sectionId: string;
  date: string;
  startTime: string;
  endTime: string;
  markCompleted: boolean;
  actualMinutes: string;
};

export function validateManualSession(
  i: ManualSessionInput,
  year: YearBounds | null,
  today: string,
): Errors {
  const e: Errors = {};
  if (!i.subjectId) e.subjectId = "Choose a subject.";
  if (!i.sectionId) e.sectionId = "Choose a section.";
  if (!i.date) e.date = "Choose the date.";
  else if (!isValidISODate(i.date)) e.date = "That is not a valid date.";
  else if (year && !termForDate(i.date, year.terms))
    e.date = "This date is not inside Term 1, 2 or 3. Adjust the term dates or choose another day.";
  validateTimes(e, i.startTime, i.endTime);
  if (i.markCompleted) {
    if (!e.date && i.date > today) e.date = "A session in the future cannot be marked Completed.";
    if (i.actualMinutes.trim() !== "") {
      const err = validateActualMinutes(i.actualMinutes);
      if (err) e.actualMinutes = err;
    }
  }
  return e;
}

/** Returns an error message, or null when the value is a valid number of minutes. */
export function validateActualMinutes(value: string): string | null {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return "Enter the minutes as a whole number.";
  const n = Number(v);
  if (n < 1 || n > 1440) return "Enter between 1 and 1440 minutes.";
  return null;
}

export function validateReschedule(
  i: { date: string; startTime: string; endTime: string },
  year: YearBounds | null,
): Errors {
  const e: Errors = {};
  if (!i.date) e.date = "Choose the new date.";
  else if (!isValidISODate(i.date)) e.date = "That is not a valid date.";
  else if (year && !termForDate(i.date, year.terms))
    e.date = "This date is not inside Term 1, 2 or 3.";
  validateTimes(e, i.startTime, i.endTime);
  return e;
}

export function validateNoClassDay(
  i: { dateFrom: string; dateTo: string; reason: string },
  year: YearBounds | null,
): Errors {
  const e: Errors = {};
  if (!i.dateFrom) e.dateFrom = "Choose the first day.";
  else if (!isValidISODate(i.dateFrom)) e.dateFrom = "That is not a valid date.";
  if (!i.dateTo) e.dateTo = "Choose the last day.";
  else if (!isValidISODate(i.dateTo)) e.dateTo = "That is not a valid date.";
  if (!e.dateFrom && !e.dateTo && i.dateFrom > i.dateTo)
    e.dateTo = "The last day must not be before the first day.";
  if (year) {
    if (!e.dateFrom && i.dateFrom < year.startDate)
      e.dateFrom = "This is before the academic year starts.";
    if (!e.dateTo && i.dateTo > year.endDate) e.dateTo = "This is after the academic year ends.";
  }
  if (i.reason.trim().length > 120) e.reason = "Use 120 characters or fewer.";
  return e;
}
