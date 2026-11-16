import { describe, expect, it } from "vitest";
import {
  activeTermFor,
  currentYearFor,
  selectedYearFor,
  termStatusLabel,
  validateYear,
  type AcademicYear,
  type YearInput,
} from "./rules";

const valid = (): YearInput => ({
  name: "2026–2027",
  startDate: "2026-06-01",
  endDate: "2027-04-30",
  terms: [
    { termNumber: 1, startDate: "2026-06-01", endDate: "2026-09-30" },
    { termNumber: 2, startDate: "2026-10-05", endDate: "2027-01-31" },
    { termNumber: 3, startDate: "2027-02-08", endDate: "2027-04-30" },
  ],
});

const year = (
  id: string,
  start: string,
  end: string,
  terms: AcademicYear["terms"] = [],
): AcademicYear => ({
  id,
  name: id,
  startDate: start,
  endDate: end,
  terms,
});

describe("validateYear", () => {
  it("accepts a valid year with three ordered terms", () => {
    expect(validateYear(valid())).toEqual({});
  });

  it("requires a name and caps its length", () => {
    expect(validateYear({ ...valid(), name: "  " }).name).toBeDefined();
    expect(validateYear({ ...valid(), name: "x".repeat(41) }).name).toBeDefined();
  });

  it("rejects missing and impossible dates", () => {
    const e1 = validateYear({ ...valid(), startDate: "" });
    expect(e1.startDate).toMatch(/Choose/);
    const e2 = validateYear({ ...valid(), endDate: "2027-02-30" });
    expect(e2.endDate).toMatch(/not a valid date/);
  });

  it("rejects a year that ends on or before its start", () => {
    expect(validateYear({ ...valid(), startDate: "2027-04-30" }).endDate).toMatch(
      /after it starts/,
    );
  });

  it("rejects a term that ends before it starts", () => {
    const v = valid();
    v.terms[1] = { termNumber: 2, startDate: "2027-01-31", endDate: "2026-10-05" };
    expect(validateYear(v).term2End).toMatch(/before it starts/);
  });

  it("rejects terms outside the academic year", () => {
    const v = valid();
    v.terms[0].startDate = "2026-05-01";
    v.terms[2].endDate = "2027-06-30";
    const e = validateYear(v);
    expect(e.term1Start).toMatch(/before the academic year/);
    expect(e.term3End).toMatch(/after the academic year/);
  });

  it("rejects overlapping terms and terms that touch on the same day", () => {
    const v = valid();
    v.terms[1].startDate = "2026-09-15";
    expect(validateYear(v).term2Start).toMatch(/after Term 1 ends/);
    const same = valid();
    same.terms[1].startDate = "2026-09-30"; // same day Term 1 ends
    expect(validateYear(same).term2Start).toMatch(/after Term 1 ends/);
  });

  it("rejects terms out of chronological order", () => {
    const v = valid();
    v.terms = [
      { termNumber: 1, startDate: "2027-02-08", endDate: "2027-04-30" },
      { termNumber: 2, startDate: "2026-10-05", endDate: "2027-01-31" },
      { termNumber: 3, startDate: "2026-06-01", endDate: "2026-09-30" },
    ];
    const e = validateYear(v);
    expect(e.term2Start).toBeDefined();
    expect(e.term3Start).toBeDefined();
  });

  it("requires all three terms", () => {
    const v = valid();
    v.terms = v.terms.slice(0, 2);
    const e = validateYear(v);
    expect(e.term3Start).toMatch(/Choose/);
    expect(e.term3End).toMatch(/Choose/);
  });

  it("allows a break between terms", () => {
    const v = valid(); // already has gaps (Oct 1–4, Feb 1–7)
    expect(validateYear(v)).toEqual({});
  });
});

describe("activeTermFor", () => {
  const terms = valid().terms.map((t, i) => ({ id: `t${i + 1}`, ...t }));
  it("includes both boundary days", () => {
    expect(activeTermFor(terms, "2026-06-01")?.termNumber).toBe(1);
    expect(activeTermFor(terms, "2026-09-30")?.termNumber).toBe(1);
    expect(activeTermFor(terms, "2026-10-05")?.termNumber).toBe(2);
    expect(activeTermFor(terms, "2027-04-30")?.termNumber).toBe(3);
  });
  it("returns null between terms and outside the year", () => {
    expect(activeTermFor(terms, "2026-10-02")).toBeNull();
    expect(activeTermFor(terms, "2026-05-31")).toBeNull();
    expect(activeTermFor(terms, "2027-05-01")).toBeNull();
  });
});

describe("currentYearFor / selectedYearFor", () => {
  const past = year("past", "2025-06-01", "2026-04-30");
  const now = year("now", "2026-06-01", "2027-04-30");
  const future = year("future", "2027-06-01", "2028-04-30");
  const all = [past, now, future];

  it("finds the year containing today", () => {
    expect(currentYearFor(all, "2026-11-16")?.id).toBe("now");
    expect(currentYearFor(all, "2026-05-15")).toBeNull();
  });

  it("prefers the explicit choice, then current, then most recent", () => {
    expect(selectedYearFor(all, "past", "2026-11-16")?.id).toBe("past");
    expect(selectedYearFor(all, null, "2026-11-16")?.id).toBe("now");
    expect(selectedYearFor(all, "missing-id", "2026-11-16")?.id).toBe("now");
    expect(selectedYearFor(all, null, "2026-05-15")?.id).toBe("future");
    expect(selectedYearFor([], null, "2026-11-16")).toBeNull();
  });
});

describe("termStatusLabel", () => {
  const y = year(
    "y",
    "2026-06-01",
    "2027-04-30",
    valid().terms.map((t, i) => ({ id: `t${i}`, ...t })),
  );
  it("describes where today falls", () => {
    expect(termStatusLabel(y, "2026-11-16")).toBe("Term 2");
    expect(termStatusLabel(y, "2026-10-02")).toBe("Between terms");
    expect(termStatusLabel(y, "2026-05-01")).toBe("Not started");
    expect(termStatusLabel(y, "2027-06-01")).toBe("Ended");
  });
});
