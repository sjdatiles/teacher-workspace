import { addDays } from "@/lib/time";
import type { DueFilter, TaskStatus } from "@/features/tasks/constants";
import type { Task } from "@/features/tasks/types";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "./teacher";

type Row = {
  id: string;
  title: string;
  description: string;
  category: Task["category"];
  status: TaskStatus;
  priority: Task["priority"];
  due_date: string | null;
  notes: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
const COLS =
  "id, title, description, category, status, priority, due_date, notes, completed_at, created_at, updated_at";

const toTask = (r: Row): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  status: r.status,
  priority: r.priority,
  dueDate: r.due_date,
  notes: r.notes,
  completedAt: r.completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const TASK_FETCH_LIMIT = 1000;

export type TaskQuery = {
  q: string;
  category: string;
  status: string;
  priority: string;
  due: DueFilter;
  today: string;
};

/** The teacher's tasks matching the filters (sorting and paging happen in the page). */
export async function getTasks(f: TaskQuery): Promise<{ tasks: Task[]; truncated: boolean }> {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  let q = supabase.from("tasks").select(COLS).eq("user_id", teacher.id);
  if (f.category) q = q.eq("category", f.category);
  if (f.status) q = q.eq("status", f.status);
  if (f.priority) q = q.eq("priority", f.priority);
  if (f.q) {
    // Characters with a meaning inside PostgREST filters are dropped rather than escaped.
    const safe = f.q.replace(/[%*,()\\"]/g, " ").trim();
    if (safe) q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,notes.ilike.%${safe}%`);
  }
  if (f.due === "overdue") q = q.lt("due_date", f.today).neq("status", "completed");
  if (f.due === "today") q = q.eq("due_date", f.today);
  if (f.due === "week") q = q.gte("due_date", f.today).lte("due_date", addDays(f.today, 7));
  if (f.due === "none") q = q.is("due_date", null);

  const res = await q.limit(TASK_FETCH_LIMIT);
  if (res.error) throw new Error("Could not load your tasks.");
  const rows = (res.data ?? []) as Row[];
  return { tasks: rows.map(toTask), truncated: rows.length >= TASK_FETCH_LIMIT };
}

export type TaskCounts = Record<TaskStatus, number> & { overdue: number; total: number };

/** Totals for the summary strip, regardless of the filters in use. */
export async function getTaskCounts(today: string): Promise<TaskCounts> {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const count = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const res = await build(base());
    if (res.error) throw new Error("Could not load your tasks.");
    return res.count ?? 0;
  };
  const base = () =>
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", teacher.id);

  const [todo, inProgress, forReview, completed, overdue] = await Promise.all([
    count((q) => q.eq("status", "todo")),
    count((q) => q.eq("status", "in_progress")),
    count((q) => q.eq("status", "for_review")),
    count((q) => q.eq("status", "completed")),
    count((q) => q.lt("due_date", today).neq("status", "completed")),
  ]);
  return {
    todo,
    in_progress: inProgress,
    for_review: forReview,
    completed,
    overdue,
    total: todo + inProgress + forReview + completed,
  };
}
