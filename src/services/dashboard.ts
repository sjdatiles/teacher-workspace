import { itemsOnDate } from "@/features/calendar/items";
import type { CalendarItem } from "@/features/calendar/types";
import { createClient } from "@/lib/supabase/server";
import { addDays, endOfMonth, startOfMonth } from "@/lib/time";
import type { PeriodKey } from "@/features/reports/rules";
import { getClassesData, getSessionTotals, type SessionTotals } from "./classes";
import { getReport, type ReportData } from "./reports";
import { getCalendarItems } from "./calendar";
import { getTaskCounts, type TaskCounts } from "./tasks";
import { requireTeacher } from "./teacher";

export type DashboardTask = {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
};

export type Progress = {
  /** What the numbers cover: "Term 2" or "Entire year". */
  label: string;
  report: ReportData;
  /** Completed sessions out of the sessions that are still meant to happen (Scheduled + Completed). */
  planned: number;
  completed: number;
};

export type DashboardData = {
  today: CalendarItem[];
  upcoming: CalendarItem[];
  /** Everything in the visible month, for the mini calendar. */
  month: CalendarItem[];
  stats: {
    subjects: number;
    sections: number;
    students: number;
    totals: SessionTotals;
    pendingTasks: number;
  };
  taskCounts: TaskCounts;
  openTasks: DashboardTask[];
  progress: Progress;
};

const UPCOMING_DAYS = 30;
const UPCOMING_LIMIT = 6;
const UPCOMING_SESSIONS_MAX = 3;

/** Everything the Home page shows, from the teacher's real records for the selected academic year. */
export async function getDashboard(args: {
  yearId: string;
  today: string;
  activeTermId: string | null;
  activeTermNumber: number | null;
}): Promise<DashboardData> {
  const { yearId, today, activeTermId, activeTermNumber } = args;
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const monthFrom = startOfMonth(today);
  const to = [endOfMonth(today), addDays(today, UPCOMING_DAYS)].sort().at(-1)!;

  const reportPeriod = (activeTermNumber ? `term${activeTermNumber}` : "year") as PeriodKey;
  const plannedQuery = supabase
    .from("teaching_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", teacher.id)
    .eq("academic_year_id", yearId)
    .in("status", ["scheduled", "completed"]);

  const [items, classes, totals, taskCounts, tasksRes, report, planned] = await Promise.all([
    getCalendarItems(monthFrom, to),
    getClassesData(yearId),
    getSessionTotals(yearId, today),
    getTaskCounts(today),
    supabase
      .from("tasks")
      .select("id, title, priority, status, due_date")
      .eq("user_id", teacher.id)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    getReport({
      yearId,
      period: reportPeriod,
      from: "",
      to: "",
      subject: "",
      section: "",
      rangeError: null,
    }),
    activeTermId ? plannedQuery.eq("term_id", activeTermId) : plannedQuery,
  ]);
  if (tasksRes.error) throw new Error("Could not load your tasks.");
  if (planned.error) throw new Error("Could not load your teaching progress.");

  const upcomingAll = items
    .filter(
      (i) =>
        i.kind !== "noclass" && i.endDate >= today && i.startDate <= addDays(today, UPCOMING_DAYS),
    )
    .filter((i) => i.kind !== "session" || i.status === "scheduled")
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
  let sessionCount = 0;
  const upcoming = upcomingAll
    .filter((i) => {
      if (i.kind !== "session") return true;
      sessionCount += 1;
      return sessionCount <= UPCOMING_SESSIONS_MAX;
    })
    .slice(0, UPCOMING_LIMIT);

  return {
    today: itemsOnDate(items, today),
    upcoming,
    month: items,
    stats: {
      subjects: classes.subjects.length,
      sections: classes.sections.length,
      students: classes.sections.reduce((n, s) => n + s.population, 0),
      totals,
      pendingTasks: taskCounts.todo + taskCounts.in_progress + taskCounts.for_review,
    },
    taskCounts,
    openTasks: (tasksRes.data ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      priority: t.priority as string,
      status: t.status as string,
      dueDate: (t.due_date as string | null) ?? null,
    })),
    progress: {
      label: activeTermNumber ? `Term ${activeTermNumber}` : "Entire year",
      report,
      planned: planned.count ?? 0,
      completed: report.totals.sessions,
    },
  };
}
