export type EventCategory = "meeting" | "school_activity" | "deadline" | "personal" | "other";
/** Categories shown on the calendar: the five manual ones plus the two for teaching sessions. */
export type DisplayCategory = EventCategory | "teaching_schedule" | "teaching_session";

export const MANUAL_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "meeting", label: "Meeting" },
  { value: "school_activity", label: "School Activity" },
  { value: "deadline", label: "Deadline" },
  { value: "personal", label: "Personal Event" },
  { value: "other", label: "Other" },
];

export const DISPLAY_CATEGORIES: { value: DisplayCategory; label: string }[] = [
  { value: "teaching_schedule", label: "Teaching Schedule" },
  { value: "teaching_session", label: "Teaching Session" },
  ...MANUAL_CATEGORIES,
];

export const categoryLabel = (c: string) =>
  DISPLAY_CATEGORIES.find((x) => x.value === c)?.label ?? "Other";

export type ColorKey = "orange" | "blue" | "green" | "amber" | "red" | "violet";
export const COLOR_KEYS: ColorKey[] = ["orange", "blue", "green", "amber", "red", "violet"];

/** Static class names (Tailwind needs full strings). */
export const COLOR_CLASSES: Record<ColorKey, { chip: string; dot: string; label: string }> = {
  orange: { chip: "bg-brand-100 text-brand-700", dot: "bg-brand-500", label: "Orange" },
  blue: { chip: "bg-info-50 text-info-500", dot: "bg-info-500", label: "Blue" },
  green: { chip: "bg-success-50 text-success-500", dot: "bg-success-500", label: "Green" },
  amber: { chip: "bg-warning-50 text-warning-500", dot: "bg-warning-500", label: "Amber" },
  red: { chip: "bg-danger-50 text-danger-500", dot: "bg-danger-500", label: "Red" },
  violet: { chip: "bg-violet-50 text-violet-500", dot: "bg-violet-500", label: "Violet" },
};

/** Color used when the teacher has not picked one. */
export const DEFAULT_COLOR: Record<DisplayCategory, ColorKey> = {
  teaching_schedule: "orange",
  teaching_session: "orange",
  meeting: "blue",
  school_activity: "green",
  deadline: "red",
  personal: "violet",
  other: "amber",
};

export type RepeatFreq = "none" | "daily" | "weekly" | "monthly";
export const REPEAT_OPTIONS: { value: RepeatFreq; label: string; unit: string }[] = [
  { value: "none", label: "Does not repeat", unit: "" },
  { value: "daily", label: "Daily", unit: "day" },
  { value: "weekly", label: "Weekly", unit: "week" },
  { value: "monthly", label: "Monthly", unit: "month" },
];

export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No reminder" },
  { value: "0", label: "At the start" },
  { value: "10", label: "10 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
  { value: "10080", label: "1 week before" },
];
export const reminderLabel = (m: number | null) =>
  m === null
    ? "No reminder"
    : (REMINDER_OPTIONS.find((o) => o.value === String(m))?.label ?? `${m} minutes before`);

export type CalendarView = "month" | "week" | "day";
export const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];
