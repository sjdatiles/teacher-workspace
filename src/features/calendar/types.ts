import type { DisplayCategory, EventCategory, RepeatFreq } from "./constants";

/** A stored event (the series definition for repeating events). */
export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  color: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null; // HH:MM, null = all-day
  endTime: string | null;
  location: string;
  notes: string;
  reminderMinutes: number | null;
  repeatFreq: RepeatFreq;
  repeatInterval: number;
  repeatUntil: string | null;
};

/** A change or skip of one occurrence of a repeating event. */
export type EventException = {
  eventId: string;
  occurrenceDate: string;
  cancelled: boolean;
  title: string | null;
  description: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string;
  notes: string;
};

/** One dated appearance of an event on the calendar. */
export type EventOccurrence = {
  eventId: string;
  /** The date this occurrence normally starts on (identifies it inside its series). */
  occurrenceDate: string;
  title: string;
  description: string;
  location: string;
  notes: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  changed: boolean;
};

/** Everything the calendar grid draws, whatever its source. */
export type CalendarItem = {
  key: string;
  kind: "event" | "session" | "noclass";
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  category: DisplayCategory | "noclass";
  color: string;
  /** Session status, for dimming cancelled / rescheduled ones. */
  status?: string;
  occurrence?: EventOccurrence;
  event?: CalendarEvent;
  sessionId?: string;
};
