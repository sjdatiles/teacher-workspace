import { cache } from "react";
import { SESSIONS_PAGE_SIZE, type SessionStatus } from "@/features/classes/constants";
import { trimTime } from "@/features/classes/rules";
import type { NoClassDay, Schedule, Section, Session, Subject } from "@/features/classes/types";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "./teacher";

/** Reads fail loudly: an error must never look like "no data". */
function ok<T>(res: { data: T | null; error: unknown }, what: string): T {
  if (res.error || res.data === null) throw new Error(`Could not load ${what}.`);
  return res.data;
}

export type ClassesData = {
  subjects: Subject[];
  sections: Section[];
  schedules: Schedule[];
  noClassDays: NoClassDay[];
};

/** Subjects, sections, assignments, schedules and no-class days of one academic year. */
export const getClassesData = cache(async (yearId: string): Promise<ClassesData> => {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const mine = (table: string) => supabase.from(table);

  const [subjectsRes, sectionsRes, linksRes, schedulesRes, daysRes] = await Promise.all([
    mine("subjects")
      .select("id, name, code, grade_level, description")
      .eq("user_id", teacher.id)
      .eq("academic_year_id", yearId)
      .order("grade_level")
      .order("name"),
    mine("class_sections")
      .select("id, name, grade_level, population, description")
      .eq("user_id", teacher.id)
      .eq("academic_year_id", yearId)
      .order("grade_level")
      .order("name"),
    mine("subject_sections")
      .select("subject_id, section_id")
      .eq("user_id", teacher.id)
      .eq("academic_year_id", yearId),
    mine("teaching_schedules")
      .select(
        "id, subject_id, section_id, day_of_week, start_time, end_time, duration_minutes, effective_start, effective_end, term_numbers",
      )
      .eq("user_id", teacher.id)
      .eq("academic_year_id", yearId)
      .order("day_of_week")
      .order("start_time"),
    mine("no_class_days")
      .select("id, date_from, date_to, reason")
      .eq("user_id", teacher.id)
      .eq("academic_year_id", yearId)
      .order("date_from"),
  ]);

  const links = ok(linksRes, "class assignments") as { subject_id: string; section_id: string }[];

  const subjects: Subject[] = (
    ok(subjectsRes, "subjects") as {
      id: string;
      name: string;
      code: string | null;
      grade_level: string;
      description: string;
    }[]
  ).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code ?? "",
    gradeLevel: s.grade_level,
    description: s.description,
    sectionIds: links.filter((l) => l.subject_id === s.id).map((l) => l.section_id),
  }));

  const sections: Section[] = (
    ok(sectionsRes, "sections") as {
      id: string;
      name: string;
      grade_level: string;
      population: number;
      description: string;
    }[]
  ).map((s) => ({
    id: s.id,
    name: s.name,
    gradeLevel: s.grade_level,
    population: s.population,
    description: s.description,
    subjectIds: links.filter((l) => l.section_id === s.id).map((l) => l.subject_id),
  }));

  const schedules: Schedule[] = (
    ok(schedulesRes, "schedules") as {
      id: string;
      subject_id: string;
      section_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      duration_minutes: number;
      effective_start: string;
      effective_end: string;
      term_numbers: number[];
    }[]
  ).map((s) => ({
    id: s.id,
    subjectId: s.subject_id,
    sectionId: s.section_id,
    dayOfWeek: s.day_of_week,
    startTime: trimTime(s.start_time),
    endTime: trimTime(s.end_time),
    durationMinutes: s.duration_minutes,
    effectiveStart: s.effective_start,
    effectiveEnd: s.effective_end,
    termNumbers: s.term_numbers,
  }));

  const noClassDays: NoClassDay[] = (
    ok(daysRes, "no-class days") as {
      id: string;
      date_from: string;
      date_to: string;
      reason: string;
    }[]
  ).map((d) => ({ id: d.id, dateFrom: d.date_from, dateTo: d.date_to, reason: d.reason }));

  return { subjects, sections, schedules, noClassDays };
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
export type SessionFilters = {
  when: "upcoming" | "past" | "all";
  term: number | null;
  status: SessionStatus | null;
  subjectId: string | null;
  sectionId: string | null;
  page: number;
};

export type SessionsPage = { rows: Session[]; total: number; pageSize: number };

type SessionRow = {
  id: string;
  subject_id: string;
  section_id: string;
  schedule_id: string | null;
  origin: Session["origin"];
  session_date: string;
  start_time: string;
  end_time: string;
  scheduled_minutes: number;
  status: SessionStatus;
  actual_minutes: number | null;
  term_id: string;
  rescheduled_from_id: string | null;
  notes: string;
};

export async function getSessions(
  yearId: string,
  termNumberById: Map<string, number>,
  today: string,
  f: SessionFilters,
): Promise<SessionsPage> {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  let q = supabase
    .from("teaching_sessions")
    .select(
      "id, subject_id, section_id, schedule_id, origin, session_date, start_time, end_time, scheduled_minutes, status, actual_minutes, term_id, rescheduled_from_id, notes",
      { count: "exact" },
    )
    .eq("user_id", teacher.id)
    .eq("academic_year_id", yearId);

  if (f.when === "upcoming") q = q.gte("session_date", today);
  if (f.when === "past") q = q.lt("session_date", today);
  if (f.status) q = q.eq("status", f.status);
  if (f.subjectId) q = q.eq("subject_id", f.subjectId);
  if (f.sectionId) q = q.eq("section_id", f.sectionId);
  if (f.term) {
    const termIds = [...termNumberById].filter(([, n]) => n === f.term).map(([id]) => id);
    q = q.in("term_id", termIds);
  }

  const asc = f.when !== "past";
  const from = (f.page - 1) * SESSIONS_PAGE_SIZE;
  const res = await q
    .order("session_date", { ascending: asc })
    .order("start_time", { ascending: true })
    .range(from, from + SESSIONS_PAGE_SIZE - 1);
  if (res.error) throw new Error("Could not load teaching sessions.");

  const data = (res.data ?? []) as SessionRow[];

  // Which of these have a replacement (so "Undo reschedule" is offered only when valid).
  const rescheduledIds = data.filter((r) => r.status === "rescheduled").map((r) => r.id);
  let replaced = new Set<string>();
  if (rescheduledIds.length > 0) {
    const rep = await supabase
      .from("teaching_sessions")
      .select("rescheduled_from_id")
      .eq("user_id", teacher.id)
      .in("rescheduled_from_id", rescheduledIds);
    if (rep.error) throw new Error("Could not load teaching sessions.");
    replaced = new Set((rep.data ?? []).map((r) => r.rescheduled_from_id as string));
  }

  return {
    total: res.count ?? 0,
    pageSize: SESSIONS_PAGE_SIZE,
    rows: data.map((r) => ({
      id: r.id,
      subjectId: r.subject_id,
      sectionId: r.section_id,
      scheduleId: r.schedule_id,
      origin: r.origin,
      date: r.session_date,
      startTime: trimTime(r.start_time),
      endTime: trimTime(r.end_time),
      scheduledMinutes: r.scheduled_minutes,
      status: r.status,
      actualMinutes: r.actual_minutes,
      termNumber: termNumberById.get(r.term_id) ?? 0,
      rescheduledFromId: r.rescheduled_from_id,
      hasReplacement: replaced.has(r.id),
      notes: r.notes,
    })),
  };
}

export type SessionTotals = {
  completedSessions: number;
  completedMinutes: number;
  /** Past sessions that are still Scheduled (the teacher may want to bulk-complete them). */
  pastScheduled: number;
};

/**
 * Completed totals for the header. ONLY sessions with status 'completed' count.
 * Pages through the rows so a long year can never be silently truncated.
 */
export async function getSessionTotals(yearId: string, today: string): Promise<SessionTotals> {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  let completedSessions = 0;
  let completedMinutes = 0;
  const step = 1000;
  for (let from = 0; ; from += step) {
    const res = await supabase
      .from("teaching_sessions")
      .select("actual_minutes")
      .eq("user_id", teacher.id)
      .eq("academic_year_id", yearId)
      .eq("status", "completed")
      .order("id")
      .range(from, from + step - 1);
    if (res.error) throw new Error("Could not load teaching totals.");
    const rows = res.data ?? [];
    completedSessions += rows.length;
    completedMinutes += rows.reduce((sum, r) => sum + (r.actual_minutes ?? 0), 0);
    if (rows.length < step) break;
  }

  const past = await supabase
    .from("teaching_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", teacher.id)
    .eq("academic_year_id", yearId)
    .eq("status", "scheduled")
    .lt("session_date", today);
  if (past.error) throw new Error("Could not load teaching totals.");

  return { completedSessions, completedMinutes, pastScheduled: past.count ?? 0 };
}
