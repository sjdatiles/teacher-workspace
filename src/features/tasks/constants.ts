import type { Tone } from "@/components/ui/Badge";

export type TaskCategory =
  "teaching" | "administrative" | "school_activities" | "personal" | "other";
export type TaskStatus = "todo" | "in_progress" | "for_review" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const TASK_CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "teaching", label: "Teaching" },
  { value: "administrative", label: "Administrative" },
  { value: "school_activities", label: "School Activities" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string; tone: Tone }[] = [
  { value: "todo", label: "To Do", tone: "neutral" },
  { value: "in_progress", label: "In Progress", tone: "info" },
  { value: "for_review", label: "For Review", tone: "violet" },
  { value: "completed", label: "Completed", tone: "success" },
];

/** Listed low → urgent; `rank` is used for sorting (urgent first). */
export const TASK_PRIORITIES: { value: TaskPriority; label: string; tone: Tone; rank: number }[] = [
  { value: "low", label: "Low", tone: "neutral", rank: 1 },
  { value: "medium", label: "Medium", tone: "info", rank: 2 },
  { value: "high", label: "High", tone: "warning", rank: 3 },
  { value: "urgent", label: "Urgent", tone: "danger", rank: 4 },
];

export const categoryLabel = (v: string) =>
  TASK_CATEGORIES.find((c) => c.value === v)?.label ?? "Other";
export const statusMeta = (v: string) =>
  TASK_STATUSES.find((s) => s.value === v) ?? TASK_STATUSES[0];
export const priorityMeta = (v: string) =>
  TASK_PRIORITIES.find((p) => p.value === v) ?? TASK_PRIORITIES[1];

export type DueFilter = "" | "overdue" | "today" | "week" | "none";
export const DUE_FILTERS: { value: Exclude<DueFilter, "">; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due in the next 7 days" },
  { value: "none", label: "No due date" },
];

export type TaskSort = "due" | "priority" | "newest" | "updated" | "title";
export const TASK_SORTS: { value: TaskSort; label: string }[] = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "newest", label: "Newest first" },
  { value: "updated", label: "Recently updated" },
  { value: "title", label: "Title (A–Z)" },
];

export type TaskView = "list" | "board";
