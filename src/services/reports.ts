import {
  PERIODS,
  TERMS,
  byTerm,
  groupRows,
  totalsOf,
  validateRange,
  type Group,
  type PeriodKey,
} from "@/features/reports/rules";
import type { CsvDetail } from "@/features/reports/rules";
import type { ReportRow, Totals } from "@/features/reports/types";
import { formatDate } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { getClassesData } from "./classes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export type ReportRequest = {
  yearId: string;
  period: PeriodKey;
  from: string;
  to: string;
  subject: string;
  section: string;
  rangeError: string | null;
};

/**
 * Reads the report settings from the URL. Used by the page AND the CSV export so both
 * always describe the same report. Unknown or foreign ids are dropped, never trusted.
 */
export async function parseReportRequest(
  sp: Record<string, string | string[] | undefined>,
  yearId: string,
  activeTermNumber: number | null,
): Promise<ReportRequest> {
  const classes = await getClassesData(yearId);
  const asked = one(sp.period);
  const period = (
    PERIODS.some((p) => p.key === asked)
      ? asked
      : activeTermNumber
        ? `term${activeTermNumber}`
        : "year"
  ) as PeriodKey;
  const range =
    period === "range"
      ? validateRange(one(sp.from), one(sp.to))
      : { from: "", to: "", error: null };
  const subject =
    UUID.test(one(sp.subject)) && classes.subjects.some((s) => s.id === one(sp.subject))
      ? one(sp.subject)
      : "";
  const section =
    UUID.test(one(sp.section)) && classes.sections.some((s) => s.id === one(sp.section))
      ? one(sp.section)
      : "";
  return {
    yearId,
    period,
    from: range.from,
    to: range.to,
    subject,
    section,
    rangeError: range.error,
  };
}

export type ReportData = {
  totals: Totals;
  terms: (Totals & { term: 1 | 2 | 3 })[];
  sections: Group[];
  subjects: Group[];
  details: CsvDetail[];
  periodLabel: string;
  subjectLabel: string;
  sectionLabel: string;
};

export function periodLabel(req: Pick<ReportRequest, "period" | "from" | "to">): string {
  if (req.period === "range") {
    if (req.from && req.to) return `${formatDate(req.from)} – ${formatDate(req.to)}`;
    if (req.from) return `From ${formatDate(req.from)}`;
    if (req.to) return `Until ${formatDate(req.to)}`;
    return "All dates";
  }
  return PERIODS.find((p) => p.key === req.period)?.label ?? "Entire year";
}

/** Runs the report. Only Completed sessions are counted (enforced inside the database function). */
export async function getReport(req: ReportRequest): Promise<ReportData> {
  const classes = await getClassesData(req.yearId);

  let rows: ReportRow[] = [];
  if (!req.rangeError) {
    const supabase = await createClient();
    const term = req.period.startsWith("term") ? Number(req.period.slice(4)) : null;
    const res = await supabase.rpc("completed_session_report", {
      p_year: req.yearId,
      p_term: term,
      p_from: req.period === "range" && req.from ? req.from : null,
      p_to: req.period === "range" && req.to ? req.to : null,
      p_subject: req.subject || null,
      p_section: req.section || null,
    });
    if (res.error) throw new Error("Could not load your report.");
    const data = (res.data ?? []) as {
      term_number: number;
      subject_id: string;
      section_id: string;
      sessions: number;
      minutes: number;
      students: number;
    }[];
    // One row per term x subject x section, so this can only reach the cap with an enormous class load.
    if (data.length >= 1000)
      throw new Error("This report is too large. Narrow it with a subject or section filter.");
    rows = data
      .filter((r) => (TERMS as readonly number[]).includes(r.term_number))
      .map((r) => ({
        term: r.term_number as 1 | 2 | 3,
        subjectId: r.subject_id,
        sectionId: r.section_id,
        sessions: Number(r.sessions),
        minutes: Number(r.minutes),
        students: Number(r.students),
      }));
  }

  const subjectLabels = new Map(
    classes.subjects.map((s) => [s.id, { label: s.name, order: `${s.gradeLevel}|${s.name}` }]),
  );
  const sectionLabels = new Map(
    classes.sections.map((s) => [
      s.id,
      { label: `${s.gradeLevel} – ${s.name}`, order: `${s.gradeLevel}|${s.name}` },
    ]),
  );
  const subjectById = new Map(classes.subjects.map((s) => [s.id, s]));
  const sectionById = new Map(classes.sections.map((s) => [s.id, s]));

  const details: CsvDetail[] = rows
    .map((r) => ({
      term: r.term,
      subject: subjectById.get(r.subjectId)?.name ?? "Removed subject",
      grade: sectionById.get(r.sectionId)?.gradeLevel ?? "",
      section: sectionById.get(r.sectionId)?.name ?? "Removed section",
      sessions: r.sessions,
      minutes: r.minutes,
      students: r.students,
    }))
    .sort(
      (a, b) =>
        a.term - b.term || a.subject.localeCompare(b.subject) || a.section.localeCompare(b.section),
    );

  return {
    totals: totalsOf(rows),
    terms: byTerm(rows),
    sections: groupRows(rows, "sectionId", sectionLabels),
    subjects: groupRows(rows, "subjectId", subjectLabels),
    details,
    periodLabel: periodLabel(req),
    subjectLabel: req.subject ? (subjectById.get(req.subject)?.name ?? "") : "All subjects",
    sectionLabel: req.section
      ? `${sectionById.get(req.section)?.gradeLevel ?? ""} – ${sectionById.get(req.section)?.name ?? ""}`
      : "All sections",
  };
}
