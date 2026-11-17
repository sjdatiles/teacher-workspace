import { addDays, isValidISODate } from "@/lib/time";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  priorityMeta,
  type DueFilter,
  type TaskSort,
} from "./constants";
import type { Task } from "./types";

export type Errors = Record<string, string>;

export type TaskInput = {
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  dueDate: string;
  notes: string;
};

export function validateTask(i: TaskInput): Errors {
  const e: Errors = {};
  const title = i.title.trim();
  if (!title) e.title = "Enter a title.";
  else if (title.length > 160) e.title = "Use 160 characters or fewer.";
  if (i.description.trim().length > 1000) e.description = "Use 1000 characters or fewer.";
  if (i.notes.trim().length > 1000) e.notes = "Use 1000 characters or fewer.";
  if (!TASK_CATEGORIES.some((c) => c.value === i.category)) e.category = "Choose a category.";
  if (!TASK_STATUSES.some((s) => s.value === i.status)) e.status = "Choose a status.";
  if (!TASK_PRIORITIES.some((p) => p.value === i.priority)) e.priority = "Choose a priority.";
  if (i.dueDate && !isValidISODate(i.dueDate)) e.dueDate = "That is not a valid date.";
  return e;
}

/** A task is overdue when its due date is before today and it is not Completed. */
export function isOverdue(t: Pick<Task, "dueDate" | "status">, today: string): boolean {
  return t.status !== "completed" && t.dueDate !== null && t.dueDate < today;
}

/** True when a task passes a due-date filter ("" = no filter). */
export function matchesDue(
  t: Pick<Task, "dueDate" | "status">,
  due: DueFilter,
  today: string,
): boolean {
  switch (due) {
    case "overdue":
      return isOverdue(t, today);
    case "today":
      return t.dueDate === today;
    case "week":
      return t.dueDate !== null && t.dueDate >= today && t.dueDate <= addDays(today, 7);
    case "none":
      return t.dueDate === null;
    default:
      return true;
  }
}

/** Sorts a copy. Ties fall back to title so the order is stable. Tasks without a due date go last. */
export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title);
  const cmp: Record<TaskSort, (a: Task, b: Task) => number> = {
    due: (a, b) => {
      if (a.dueDate === b.dueDate)
        return priorityMeta(b.priority).rank - priorityMeta(a.priority).rank || byTitle(a, b);
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    },
    priority: (a, b) =>
      priorityMeta(b.priority).rank - priorityMeta(a.priority).rank ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      byTitle(a, b),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || byTitle(a, b),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || byTitle(a, b),
    title: byTitle,
  };
  return [...tasks].sort(cmp[sort]);
}

/** "Due today", "Due tomorrow", "3 days overdue", "Due Dec 5" … */
export function dueLabel(
  dueDate: string | null,
  today: string,
  formatDate: (iso: string) => string,
): string {
  if (!dueDate) return "No due date";
  if (dueDate === today) return "Due today";
  if (dueDate === addDays(today, 1)) return "Due tomorrow";
  if (dueDate < today) {
    const days = Math.round(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000,
    );
    return days === 1 ? "1 day overdue" : `${days} days overdue`;
  }
  return `Due ${formatDate(dueDate)}`;
}
