import type { Tone } from "@/components/ui/Badge";

export const GRADE_LEVELS = [
  "Kindergarten",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
] as const;

/** ISO weekday numbers (1 = Monday … 7 = Sunday), matching the database. */
export const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
] as const;

export const dayLabel = (n: number) => DAYS.find((d) => d.value === n)?.label ?? "—";

export type SessionStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";

export const SESSION_STATUSES: { value: SessionStatus; label: string; tone: Tone }[] = [
  { value: "scheduled", label: "Scheduled", tone: "info" },
  { value: "completed", label: "Completed", tone: "success" },
  { value: "cancelled", label: "Cancelled", tone: "danger" },
  { value: "rescheduled", label: "Rescheduled", tone: "warning" },
];

export const statusMeta = (s: string) =>
  SESSION_STATUSES.find((x) => x.value === s) ?? SESSION_STATUSES[0];

export const SESSIONS_PAGE_SIZE = 25;
