import { describe, expect, it } from "vitest";
import type { Term } from "@/features/academic/rules";
import {
  findScheduleConflicts,
  formatDuration,
  formatHours,
  formatTime,
  termForDate,
  validateActualMinutes,
  validateManualSession,
  validateNoClassDay,
  validateReschedule,
  validateSchedule,
  validateSection,
  validateSubject,
  type ScheduleInput,
} from "./rules";
import type { Schedule } from "./types";

const terms: Term[] = [
  { id: "t1", termNumber: 1, startDate: "2026-06-01", endDate: "2026-09-30" },
  { id: "t2", termNumber: 2, startDate: "2026-10-05", endDate: "2027-01-31" },
  { id: "t3", termNumber: 3, startDate: "2027-02-08", endDate: "2027-04-30" },
];
const year = { startDate: "2026-06-01", endDate: "2027-04-30", terms };

const sched = (over: Partial<Schedule> = {}): Schedule => ({
  id: "s1",
  subjectId: "math",
  sectionId: "rose",
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "09:00",
  durationMinutes: 60,
  effectiveStart: "2026-06-01",
  effectiveEnd: "2027-04-30",
  termNumbers: [1, 2, 3],
  ...over,
});
const input = (over: Partial<ScheduleInput> = {}): ScheduleInput => ({
  subjectId: "math",
  sectionId: "rose",
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "09:00",
  effectiveStart: "2026-06-01",
  effectiveEnd: "2027-04-30",
  termNumbers: [1, 2, 3],
  ...over,
});

describe("formatting", () => {
  it("formats times and durations", () => {
    expect(formatTime("08:00")).toBe("8:00 AM");
    expect(formatTime("00:05")).toBe("12:05 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("13:30:00")).toBe("1:30 PM");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatHours(150)).toBe("2.5");
    expect(formatHours(45)).toBe("0.75");
  });
  it("finds the term of a date", () => {
    expect(termForDate("2026-10-05", terms)?.termNumber).toBe(2);
    expect(termForDate("2026-10-01", terms)).toBeNull(); // gap between terms
  });
});

describe("subject and section", () => {
  it("validates a subject", () => {
    expect(
      validateSubject({ name: "Math", code: "", gradeLevel: "Grade 7", description: "" }),
    ).toEqual({});
    const e = validateSubject({
      name: " ",
      code: "x".repeat(21),
      gradeLevel: "Grade 13",
      description: "",
    });
    expect(Object.keys(e).sort()).toEqual(["code", "gradeLevel", "name"]);
  });
  it("validates a section's population", () => {
    const ok = { name: "Rose", gradeLevel: "Grade 7", description: "" };
    expect(validateSection({ ...ok, population: "40" })).toEqual({});
    expect(validateSection({ ...ok, population: "0" })).toEqual({});
    expect(validateSection({ ...ok, population: "" }).population).toBeTruthy();
    expect(validateSection({ ...ok, population: "-1" }).population).toBeTruthy();
    expect(validateSection({ ...ok, population: "2.5" }).population).toBeTruthy();
    expect(validateSection({ ...ok, population: "201" }).population).toBeTruthy();
  });
});

describe("validateSchedule", () => {
  it("accepts a good schedule", () => {
    expect(validateSchedule(input(), year)).toEqual({});
  });
  it("rejects bad times, dates and terms", () => {
    expect(validateSchedule(input({ endTime: "08:00" }), year).endTime).toBeTruthy();
    expect(validateSchedule(input({ startTime: "" }), year).startTime).toBeTruthy();
    expect(validateSchedule(input({ effectiveEnd: "2026-05-01" }), year).effectiveEnd).toBeTruthy();
    expect(
      validateSchedule(input({ effectiveStart: "2026-01-01" }), year).effectiveStart,
    ).toBeTruthy();
    expect(validateSchedule(input({ effectiveEnd: "2027-12-01" }), year).effectiveEnd).toBeTruthy();
    expect(validateSchedule(input({ termNumbers: [] }), year).termNumbers).toBeTruthy();
    expect(validateSchedule(input({ termNumbers: [4] }), year).termNumbers).toBeTruthy();
    expect(validateSchedule(input({ dayOfWeek: 8 }), year).dayOfWeek).toBeTruthy();
    expect(validateSchedule(input({ subjectId: "" }), year).subjectId).toBeTruthy();
  });
});

describe("findScheduleConflicts", () => {
  it("flags an exact duplicate", () => {
    const r = findScheduleConflicts(input(), [sched()]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.overlaps).toHaveLength(0);
  });
  it("ignores the schedule being edited", () => {
    expect(findScheduleConflicts(input(), [sched()], "s1")).toEqual({
      duplicates: [],
      overlaps: [],
    });
  });
  it("warns about overlapping times for a different class", () => {
    const r = findScheduleConflicts(
      input({ sectionId: "tulip", startTime: "08:30", endTime: "09:30" }),
      [sched()],
    );
    expect(r.overlaps).toHaveLength(1);
    expect(r.duplicates).toHaveLength(0);
  });
  it("does not flag back-to-back classes", () => {
    const r = findScheduleConflicts(
      input({ sectionId: "tulip", startTime: "09:00", endTime: "10:00" }),
      [sched()],
    );
    expect(r.overlaps).toHaveLength(0);
  });
  it("does not flag other days, other terms or other periods", () => {
    expect(findScheduleConflicts(input({ dayOfWeek: 2 }), [sched()]).duplicates).toHaveLength(0);
    expect(
      findScheduleConflicts(input({ termNumbers: [3] }), [sched({ termNumbers: [1, 2] })])
        .duplicates,
    ).toHaveLength(0);
    expect(
      findScheduleConflicts(input({ effectiveStart: "2027-01-01" }), [
        sched({ effectiveEnd: "2026-12-31" }),
      ]).duplicates,
    ).toHaveLength(0);
  });
  it("treats same time with different subject as an overlap, not a duplicate", () => {
    const r = findScheduleConflicts(input({ subjectId: "sci" }), [sched()]);
    expect(r.duplicates).toHaveLength(0);
    expect(r.overlaps).toHaveLength(1);
  });
});

describe("sessions", () => {
  const base = {
    subjectId: "a",
    sectionId: "b",
    date: "2026-07-01",
    startTime: "10:00",
    endTime: "11:00",
    markCompleted: false,
    actualMinutes: "",
  };
  it("accepts a manual session inside a term", () => {
    expect(validateManualSession(base, year, "2026-08-01")).toEqual({});
  });
  it("rejects a date outside every term instead of guessing a term", () => {
    expect(validateManualSession({ ...base, date: "2026-10-01" }, year, "2026-12-01").date).toMatch(
      /Term 1, 2 or 3/,
    );
  });
  it("rejects completing a future session", () => {
    expect(
      validateManualSession({ ...base, markCompleted: true }, year, "2026-06-15").date,
    ).toBeTruthy();
    expect(validateManualSession({ ...base, markCompleted: true }, year, "2026-07-01")).toEqual({});
  });
  it("validates actual minutes", () => {
    expect(validateActualMinutes("45")).toBeNull();
    expect(validateActualMinutes("0")).toBeTruthy();
    expect(validateActualMinutes("1441")).toBeTruthy();
    expect(validateActualMinutes("1.5")).toBeTruthy();
    expect(
      validateManualSession(
        { ...base, markCompleted: true, actualMinutes: "abc" },
        year,
        "2026-08-01",
      ).actualMinutes,
    ).toBeTruthy();
  });
  it("validates rescheduling and no-class days", () => {
    expect(
      validateReschedule({ date: "2026-07-02", startTime: "10:00", endTime: "11:00" }, year),
    ).toEqual({});
    expect(
      validateReschedule({ date: "2026-10-01", startTime: "10:00", endTime: "11:00" }, year).date,
    ).toBeTruthy();
    expect(
      validateNoClassDay(
        { dateFrom: "2026-12-24", dateTo: "2027-01-02", reason: "Christmas break" },
        year,
      ),
    ).toEqual({});
    expect(
      validateNoClassDay({ dateFrom: "2026-12-24", dateTo: "2026-12-01", reason: "" }, year).dateTo,
    ).toBeTruthy();
    expect(
      validateNoClassDay({ dateFrom: "2026-01-01", dateTo: "2026-01-02", reason: "" }, year)
        .dateFrom,
    ).toBeTruthy();
  });
});
