import { addDays, isValidISODate } from "@/lib/time";
import { MANUAL_CATEGORIES, COLOR_KEYS, REMINDER_OPTIONS, REPEAT_OPTIONS } from "./constants";

export type Errors = Record<string, string>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type EventInput = {
  title: string;
  description: string;
  category: string;
  color: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  reminder: string;
  repeatFreq: string;
  repeatInterval: string;
  repeatUntil: string;
};

/** Longest a series may run: matches the database (731 days after the first date). */
export const MAX_REPEAT_DAYS = 731;

/**
 * Validates an event. Pass `occurrenceOnly` when editing a single occurrence of a repeating
 * event: category, repeat and reminder belong to the whole series and are not checked.
 */
export function validateEvent(i: EventInput, occurrenceOnly = false): Errors {
  const e: Errors = {};
  const title = i.title.trim();
  if (!title) e.title = "Enter a title.";
  else if (title.length > 120) e.title = "Use 120 characters or fewer.";
  if (i.description.trim().length > 1000) e.description = "Use 1000 characters or fewer.";
  if (i.location.trim().length > 120) e.location = "Use 120 characters or fewer.";
  if (i.notes.trim().length > 1000) e.notes = "Use 1000 characters or fewer.";

  if (!occurrenceOnly) {
    if (!MANUAL_CATEGORIES.some((c) => c.value === i.category)) e.category = "Choose a category.";
    if (i.color && !(COLOR_KEYS as string[]).includes(i.color))
      e.color = "Choose one of the colors.";
    if (!REMINDER_OPTIONS.some((o) => o.value === i.reminder)) e.reminder = "Choose a reminder.";
  }

  if (!i.startDate) e.startDate = "Choose the start date.";
  else if (!isValidISODate(i.startDate)) e.startDate = "That is not a valid date.";
  if (!i.endDate) e.endDate = "Choose the end date.";
  else if (!isValidISODate(i.endDate)) e.endDate = "That is not a valid date.";
  if (!e.startDate && !e.endDate && i.endDate < i.startDate)
    e.endDate = "The end date must not be before the start date.";

  if (!i.allDay) {
    if (!TIME.test(i.startTime)) e.startTime = "Choose the start time.";
    if (!TIME.test(i.endTime)) e.endTime = "Choose the end time.";
    if (
      !e.startTime &&
      !e.endTime &&
      !e.startDate &&
      !e.endDate &&
      i.startDate === i.endDate &&
      i.endTime <= i.startTime
    )
      e.endTime = "The end time must be after the start time.";
  }

  if (!occurrenceOnly) {
    const freq = REPEAT_OPTIONS.find((o) => o.value === i.repeatFreq);
    if (!freq) e.repeatFreq = "Choose how it repeats.";
    else if (freq.value !== "none") {
      if (
        !/^\d+$/.test(i.repeatInterval) ||
        Number(i.repeatInterval) < 1 ||
        Number(i.repeatInterval) > 12
      )
        e.repeatInterval = "Enter a number from 1 to 12.";
      if (!i.repeatUntil) e.repeatUntil = "Choose when the repeating ends.";
      else if (!isValidISODate(i.repeatUntil)) e.repeatUntil = "That is not a valid date.";
      else if (!e.startDate && i.repeatUntil < i.startDate)
        e.repeatUntil = "This is before the event starts.";
      else if (!e.startDate && i.repeatUntil > addDays(i.startDate, MAX_REPEAT_DAYS))
        e.repeatUntil = "Repeating can run for at most two years.";
    }
  }
  return e;
}

/** Search text match used for filtering lists of events. */
export function matchesQuery(q: string, ...fields: string[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f.toLowerCase().includes(needle));
}
