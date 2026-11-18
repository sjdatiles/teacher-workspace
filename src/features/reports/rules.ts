import { isValidISODate } from "@/lib/time";
import type { ReportRow, Totals } from "./types";

export type PeriodKey = "term1" | "term2" | "term3" | "year" | "range";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "term1", label: "Term 1" },
  { key: "term2", label: "Term 2" },
  { key: "term3", label: "Term 3" },
  { key: "year", label: "Entire year" },
  { key: "range", label: "Custom range" },
];

export const TERMS = [1, 2, 3] as const;

export type RangeResult = { from: string; to: string; error: string | null };

/** A custom range needs two real dates, in order. Either date may be left open. */
export function validateRange(from: string, to: string): RangeResult {
  const f = from.trim();
  const t = to.trim();
  if (f && !isValidISODate(f))
    return { from: "", to: "", error: "The start date is not a valid date." };
  if (t && !isValidISODate(t))
    return { from: "", to: "", error: "The end date is not a valid date." };
  if (f && t && f > t)
    return { from: f, to: t, error: "The start date must be on or before the end date." };
  return { from: f, to: t, error: null };
}

export function totalsOf(rows: Pick<ReportRow, "sessions" | "minutes" | "students">[]): Totals {
  return rows.reduce(
    (a, r) => ({
      sessions: a.sessions + r.sessions,
      minutes: a.minutes + r.minutes,
      students: a.students + r.students,
    }),
    { sessions: 0, minutes: 0, students: 0 },
  );
}

/** Teaching hours from minutes: "13.75", "2", "0.5". */
export function hoursOf(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
export const formatHours = (minutes: number) => String(hoursOf(minutes));

/** Always three entries (Term 1, 2, 3), zero-filled. */
export function byTerm(rows: ReportRow[]): (Totals & { term: 1 | 2 | 3 })[] {
  return TERMS.map((term) => ({ term, ...totalsOf(rows.filter((r) => r.term === term)) }));
}

export type Group = {
  id: string;
  label: string;
  /** Per-term totals, index 0 = Term 1. */
  terms: Totals[];
  total: Totals;
};

/** Groups rows by subject or section. Only groups with completed sessions appear. */
export function groupRows(
  rows: ReportRow[],
  key: "subjectId" | "sectionId",
  labels: Map<string, { label: string; order: string }>,
): Group[] {
  const ids = [...new Set(rows.map((r) => r[key]))];
  return ids
    .map((id) => {
      const mine = rows.filter((r) => r[key] === id);
      return {
        id,
        label: labels.get(id)?.label ?? "Removed",
        order: labels.get(id)?.order ?? "~",
        terms: TERMS.map((term) => totalsOf(mine.filter((r) => r.term === term))),
        total: totalsOf(mine),
      };
    })
    .sort((a, b) => a.order.localeCompare(b.order, undefined, { numeric: true }))
    .map((g) => ({ id: g.id, label: g.label, terms: g.terms, total: g.total }));
}

/** Protects spreadsheets from cells that start like a formula, and quotes when needed. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && typeof value === "string") s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvLine = (cells: (string | number)[]) => cells.map(csvCell).join(",");

export type CsvDetail = {
  term: number;
  subject: string;
  grade: string;
  section: string;
  sessions: number;
  minutes: number;
  students: number;
};

/** The whole export. Its numbers come from the same rows as the screen, so they always agree. */
export function buildCsv(meta: [string, string][], details: CsvDetail[]): string {
  const lines: string[] = meta.map(([k, v]) => csvLine([k, v]));
  lines.push("");
  lines.push(
    csvLine([
      "Term",
      "Subject",
      "Grade level",
      "Section",
      "Completed sessions",
      "Teaching hours",
      "Students taught",
    ]),
  );
  for (const d of details) {
    lines.push(
      csvLine([
        `Term ${d.term}`,
        d.subject,
        d.grade,
        d.section,
        d.sessions,
        hoursOf(d.minutes),
        d.students,
      ]),
    );
  }
  const t = totalsOf(details);
  lines.push(csvLine(["Total", "", "", "", t.sessions, hoursOf(t.minutes), t.students]));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
