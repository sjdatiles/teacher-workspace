import { describe, expect, it } from "vitest";
import {
  buildCsv,
  byTerm,
  csvCell,
  formatHours,
  groupRows,
  totalsOf,
  validateRange,
} from "./rules";
import type { ReportRow } from "./types";

const rows: ReportRow[] = [
  { term: 1, subjectId: "m", sectionId: "r", sessions: 2, minutes: 120, students: 70 },
  { term: 1, subjectId: "s", sectionId: "l", sessions: 1, minutes: 45, students: 40 },
  { term: 2, subjectId: "m", sectionId: "r", sessions: 1, minutes: 60, students: 35 },
];

describe("totals", () => {
  it("adds sessions, minutes and students", () =>
    expect(totalsOf(rows)).toEqual({ sessions: 4, minutes: 225, students: 145 }));
  it("is zero for no rows", () =>
    expect(totalsOf([])).toEqual({ sessions: 0, minutes: 0, students: 0 }));
  it("formats hours from minutes", () => {
    expect(formatHours(225)).toBe("3.75");
    expect(formatHours(120)).toBe("2");
    expect(formatHours(0)).toBe("0");
    expect(formatHours(50)).toBe("0.83");
  });
});

describe("byTerm", () => {
  it("always has exactly three terms, zero-filled", () => {
    const t = byTerm(rows);
    expect(t.map((x) => x.term)).toEqual([1, 2, 3]);
    expect(t.map((x) => x.sessions)).toEqual([3, 1, 0]);
  });
});

describe("groupRows", () => {
  const labels = new Map([
    ["r", { label: "Grade 7 – Rose", order: "07 Rose" }],
    ["l", { label: "Grade 7 – Lily", order: "07 Lily" }],
  ]);
  it("groups by section, sorted by label order, with per-term and overall totals", () => {
    const g = groupRows(rows, "sectionId", labels);
    expect(g.map((x) => x.label)).toEqual(["Grade 7 – Lily", "Grade 7 – Rose"]);
    const rose = g[1];
    expect(rose.terms.map((t) => t.sessions)).toEqual([2, 1, 0]);
    expect(rose.total).toEqual({ sessions: 3, minutes: 180, students: 105 });
  });
  it("only lists groups with completed sessions", () =>
    expect(groupRows([], "subjectId", labels)).toEqual([]));
  it("keeps the grand total equal to the sum of the groups", () => {
    const g = groupRows(rows, "subjectId", new Map());
    expect(totalsOf(g.map((x) => x.total))).toEqual(totalsOf(rows));
  });
});

describe("validateRange", () => {
  it("accepts ordered dates and open ends", () => {
    expect(validateRange("2026-08-01", "2026-09-01").error).toBeNull();
    expect(validateRange("2026-08-01", "").error).toBeNull();
    expect(validateRange("", "").error).toBeNull();
  });
  it("rejects reversed or invalid dates", () => {
    expect(validateRange("2026-09-02", "2026-09-01").error).not.toBeNull();
    expect(validateRange("2026-13-40", "").error).not.toBeNull();
    expect(validateRange("", "nope").error).not.toBeNull();
  });
});

describe("csv", () => {
  it("quotes commas and quotes, and neutralises formulas", () => {
    expect(csvCell('Math, "Advanced"')).toBe('"Math, ""Advanced"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(-5)).toBe("-5");
  });
  it("matches the on-screen totals and ends with a Total row", () => {
    const csv = buildCsv(
      [["Academic year", "2026–2027"]],
      rows.map((r) => ({
        term: r.term,
        subject: r.subjectId,
        grade: "Grade 7",
        section: r.sectionId,
        sessions: r.sessions,
        minutes: r.minutes,
        students: r.students,
      })),
    );
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Academic year,2026–2027");
    expect(lines.at(-1)).toBe("Total,,,,4,3.75,145");
    expect(lines.length).toBe(1 + 1 + 1 + 3 + 1);
  });
});
