import { formatDate, isValidISODate } from "@/lib/time";

/**
 * Academic calendar rules. DepEd three-term structure: exactly Term 1, 2 and 3 per year.
 * These mirror the database constraints so teachers get precise messages; the database
 * remains the final authority (see supabase/migrations).
 */

export type TermNumber = 1 | 2 | 3;
export const TERM_NUMBERS: readonly TermNumber[] = [1, 2, 3];

export type Term = { id: string; termNumber: TermNumber; startDate: string; endDate: string };
export type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  terms: Term[];
};

export type YearInput = {
  name: string;
  startDate: string;
  endDate: string;
  terms: { termNumber: TermNumber; startDate: string; endDate: string }[];
};

export type YearErrors = Record<string, string>;

/** Form field names for a term's dates, e.g. term2Start. */
export const termField = (n: TermNumber, edge: "Start" | "End") => `term${n}${edge}` as const;

export function validateYear(input: YearInput): YearErrors {
  const errors: YearErrors = {};
  const name = input.name.trim();
  if (name.length < 1) errors.name = "Enter a name, for example 2026–2027.";
  else if (name.length > 40) errors.name = "Use 40 characters or fewer.";

  const dateOk = (key: string, value: string, label: string) => {
    if (!value) errors[key] = `Choose the ${label}.`;
    else if (!isValidISODate(value))
      errors[key] = `${label[0].toUpperCase()}${label.slice(1)} is not a valid date.`;
    return !errors[key];
  };

  const yStartOk = dateOk("startDate", input.startDate, "start date");
  const yEndOk = dateOk("endDate", input.endDate, "end date");
  if (yStartOk && yEndOk && input.startDate >= input.endDate) {
    errors.endDate = "The academic year must end after it starts.";
  }
  const yearUsable = yStartOk && yEndOk && !errors.endDate;

  const byNumber = new Map(input.terms.map((t) => [t.termNumber, t]));
  const usable: Partial<Record<TermNumber, { start: string; end: string }>> = {};

  for (const n of TERM_NUMBERS) {
    const t = byNumber.get(n);
    const startKey = termField(n, "Start");
    const endKey = termField(n, "End");
    const startOk = dateOk(startKey, t?.startDate ?? "", `Term ${n} start date`);
    const endOk = dateOk(endKey, t?.endDate ?? "", `Term ${n} end date`);
    if (!startOk || !endOk || !t) continue;

    if (t.startDate > t.endDate) {
      errors[endKey] = `Term ${n} cannot end before it starts.`;
      continue;
    }
    if (yearUsable && t.startDate < input.startDate) {
      errors[startKey] =
        `Term ${n} starts before the academic year (${formatDate(input.startDate)}).`;
      continue;
    }
    if (yearUsable && t.endDate > input.endDate) {
      errors[endKey] = `Term ${n} ends after the academic year (${formatDate(input.endDate)}).`;
      continue;
    }
    usable[n] = { start: t.startDate, end: t.endDate };
  }

  // Chronological order without overlap: Term 1 ends before Term 2 starts, and so on.
  const t1 = usable[1];
  const t2 = usable[2];
  const t3 = usable[3];
  if (t1 && t2 && t1.end >= t2.start) {
    errors[termField(2, "Start")] = "Term 2 must start after Term 1 ends.";
  }
  if (t2 && t3 && t2.end >= t3.start) {
    errors[termField(3, "Start")] = "Term 3 must start after Term 2 ends.";
  }
  if (t1 && t3 && !t2 && t1.end >= t3.start) {
    errors[termField(3, "Start")] = "Term 3 must start after Term 1 ends.";
  }
  return errors;
}

/** The term containing `today` (inclusive of both end dates), or null (break / outside terms). */
export function activeTermFor(terms: Term[], today: string): Term | null {
  return terms.find((t) => t.startDate <= today && today <= t.endDate) ?? null;
}

/** The academic year whose dates contain today; if several, the one that started last. */
export function currentYearFor(years: AcademicYear[], today: string): AcademicYear | null {
  const containing = years.filter((y) => y.startDate <= today && today <= y.endDate);
  return containing.sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
}

/**
 * Which year the app shows: the teacher's explicit choice, otherwise the current year,
 * otherwise the most recent year. Null when the teacher has no academic years yet.
 */
export function selectedYearFor(
  years: AcademicYear[],
  selectedId: string | null,
  today: string,
): AcademicYear | null {
  const chosen = selectedId ? years.find((y) => y.id === selectedId) : undefined;
  if (chosen) return chosen;
  const current = currentYearFor(years, today);
  if (current) return current;
  return [...years].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
}

/** Human label for where `today` falls in a year, e.g. "Term 2", "Between terms", "Year not started". */
export function termStatusLabel(year: AcademicYear, today: string): string {
  const active = activeTermFor(year.terms, today);
  if (active) return `Term ${active.termNumber}`;
  if (today < year.startDate) return "Not started";
  if (today > year.endDate) return "Ended";
  return "Between terms";
}
