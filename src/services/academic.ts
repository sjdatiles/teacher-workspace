import { cache } from "react";
import {
  activeTermFor,
  currentYearFor,
  selectedYearFor,
  type AcademicYear,
  type Term,
  type TermNumber,
} from "@/features/academic/rules";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/time";
import { requireTeacher } from "./teacher";

type TermRow = {
  id: string;
  academic_year_id: string;
  term_number: number;
  start_date: string;
  end_date: string;
};
type YearRow = { id: string; name: string; start_date: string; end_date: string };

function toYear(row: YearRow, termRows: TermRow[]): AcademicYear {
  const terms: Term[] = termRows
    .filter((t) => t.academic_year_id === row.id)
    .sort((a, b) => a.term_number - b.term_number)
    .map((t) => ({
      id: t.id,
      termNumber: t.term_number as TermNumber,
      startDate: t.start_date,
      endDate: t.end_date,
    }));
  return { id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date, terms };
}

export type AcademicContext = {
  today: string;
  years: AcademicYear[];
  /** The year every module should show (teacher's choice, else current, else latest). */
  selectedYear: AcademicYear | null;
  /** The year whose dates contain today, if any. */
  currentYear: AcademicYear | null;
  /** The term of the selected year that contains today, if any. */
  activeTerm: Term | null;
};

/**
 * Everything a page needs to know about the teacher's academic calendar.
 * Memoised per request. Rows are filtered by the teacher's id here and again by RLS.
 */
export const getAcademicContext = cache(async (): Promise<AcademicContext> => {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const today = todayISO();

  const [yearsRes, termsRes, settingsRes] = await Promise.all([
    supabase
      .from("academic_years")
      .select("id, name, start_date, end_date")
      .eq("user_id", teacher.id)
      .order("start_date", { ascending: false }),
    supabase
      .from("academic_terms")
      .select("id, academic_year_id, term_number, start_date, end_date")
      .eq("user_id", teacher.id),
    supabase
      .from("user_settings")
      .select("selected_academic_year_id")
      .eq("user_id", teacher.id)
      .maybeSingle(),
  ]);

  // Fail loudly: showing "no academic years" because a read failed would be misleading.
  if (yearsRes.error || termsRes.error || settingsRes.error) {
    throw new Error("Could not load your academic calendar.");
  }

  const termRows = (termsRes.data ?? []) as TermRow[];
  const years = ((yearsRes.data ?? []) as YearRow[]).map((y) => toYear(y, termRows));
  const selectedYear = selectedYearFor(
    years,
    settingsRes.data?.selected_academic_year_id ?? null,
    today,
  );

  return {
    today,
    years,
    selectedYear,
    currentYear: currentYearFor(years, today),
    activeTerm: selectedYear ? activeTermFor(selectedYear.terms, today) : null,
  };
});

export type NotificationSettings = {
  upcomingSessions: boolean;
  upcomingEvents: boolean;
  taskDeadlines: boolean;
};

export const getNotificationSettings = cache(async (): Promise<NotificationSettings> => {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("notify_upcoming_sessions, notify_upcoming_events, notify_task_deadlines")
    .eq("user_id", teacher.id)
    .maybeSingle();
  return {
    upcomingSessions: data?.notify_upcoming_sessions ?? true,
    upcomingEvents: data?.notify_upcoming_events ?? true,
    taskDeadlines: data?.notify_task_deadlines ?? true,
  };
});
