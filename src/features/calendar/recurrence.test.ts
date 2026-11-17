import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  isoWeekday,
  startOfMonth,
  startOfWeek,
} from "@/lib/time";
import { allOccurrenceStarts, expandEvents } from "./recurrence";
import { validateEvent, type EventInput } from "./rules";
import type { CalendarEvent, EventException } from "./types";

const base: CalendarEvent = {
  id: "e1",
  title: "Dept meeting",
  description: "",
  category: "meeting",
  color: null,
  startDate: "2026-12-07", // a Monday
  endDate: "2026-12-07",
  startTime: "14:00",
  endTime: "15:00",
  location: "",
  notes: "",
  reminderMinutes: null,
  repeatFreq: "weekly",
  repeatInterval: 1,
  repeatUntil: "2027-01-04",
};
const ex = (over: Partial<EventException>): EventException => ({
  eventId: "e1",
  occurrenceDate: "2026-12-14",
  cancelled: true,
  title: null,
  description: "",
  startDate: null,
  endDate: null,
  startTime: null,
  endTime: null,
  location: "",
  notes: "",
  ...over,
});

describe("date helpers", () => {
  it("does day and month arithmetic", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-12-01", "2026-12-04")).toBe(3);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(startOfMonth("2026-12-17")).toBe("2026-12-01");
  });
  it("uses Monday as the first day of the week", () => {
    expect(isoWeekday("2026-12-07")).toBe(1);
    expect(isoWeekday("2026-12-13")).toBe(7);
    expect(startOfWeek("2026-12-13")).toBe("2026-12-07");
    expect(startOfWeek("2026-12-07")).toBe("2026-12-07");
  });
});

describe("allOccurrenceStarts", () => {
  it("returns one date for a non-repeating event", () => {
    expect(allOccurrenceStarts({ ...base, repeatFreq: "none", repeatUntil: null })).toEqual([
      "2026-12-07",
    ]);
  });
  it("repeats weekly up to and including the end date", () => {
    expect(allOccurrenceStarts(base)).toEqual([
      "2026-12-07",
      "2026-12-14",
      "2026-12-21",
      "2026-12-28",
      "2027-01-04",
    ]);
  });
  it("supports an interval", () => {
    expect(allOccurrenceStarts({ ...base, repeatInterval: 2 })).toEqual([
      "2026-12-07",
      "2026-12-21",
      "2027-01-04",
    ]);
    expect(
      allOccurrenceStarts({
        ...base,
        repeatFreq: "daily",
        repeatInterval: 3,
        repeatUntil: "2026-12-16",
      }),
    ).toEqual(["2026-12-07", "2026-12-10", "2026-12-13", "2026-12-16"]);
  });
  it("repeats monthly on the same day, using the last day for short months", () => {
    expect(
      allOccurrenceStarts({
        ...base,
        startDate: "2026-01-31",
        endDate: "2026-01-31",
        repeatFreq: "monthly",
        repeatUntil: "2026-04-30",
      }),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("is bounded for a two-year daily series", () => {
    const n = allOccurrenceStarts({
      ...base,
      repeatFreq: "daily",
      repeatUntil: addDays(base.startDate, 731),
    }).length;
    expect(n).toBe(732);
  });
});

describe("expandEvents", () => {
  it("only returns occurrences inside the range", () => {
    const out = expandEvents([base], [], "2026-12-14", "2026-12-20");
    expect(out.map((o) => o.startDate)).toEqual(["2026-12-14"]);
  });
  it("keeps a multi-day occurrence that began before the range", () => {
    const multi = {
      ...base,
      repeatFreq: "none" as const,
      repeatUntil: null,
      startDate: "2026-12-03",
      endDate: "2026-12-05",
    };
    expect(expandEvents([multi], [], "2026-12-05", "2026-12-10")).toHaveLength(1);
    expect(expandEvents([multi], [], "2026-12-06", "2026-12-10")).toHaveLength(0);
  });
  it("leaves out a skipped occurrence", () => {
    const out = expandEvents([base], [ex({})], "2026-12-01", "2026-12-31");
    expect(out.map((o) => o.startDate)).toEqual(["2026-12-07", "2026-12-21", "2026-12-28"]);
  });
  it("applies a changed occurrence, including one moved into the range", () => {
    const changed = ex({
      occurrenceDate: "2026-12-21",
      cancelled: false,
      title: "Moved meeting",
      startDate: "2026-12-30",
      endDate: "2026-12-30",
      startTime: "10:00",
      endTime: "11:00",
    });
    const dec = expandEvents([base], [changed], "2026-12-01", "2026-12-31");
    expect(dec.find((o) => o.title === "Moved meeting")?.startDate).toBe("2026-12-30");
    expect(dec.find((o) => o.title === "Moved meeting")?.changed).toBe(true);
    expect(dec.some((o) => o.startDate === "2026-12-21")).toBe(false);
    // moved out of the viewed week: not shown there
    expect(expandEvents([base], [changed], "2026-12-21", "2026-12-27")).toHaveLength(0);
  });
  it("ignores an exception beyond a shortened series", () => {
    const orphan = ex({
      occurrenceDate: "2027-02-01",
      cancelled: false,
      title: "x",
      startDate: "2027-02-01",
      endDate: "2027-02-01",
    });
    expect(
      expandEvents([base], [orphan], "2027-01-01", "2027-03-01").map((o) => o.startDate),
    ).toEqual(["2027-01-04"]);
  });
});

describe("validateEvent", () => {
  const ok: EventInput = {
    title: "Faculty meeting",
    description: "",
    category: "meeting",
    color: "",
    startDate: "2026-12-07",
    endDate: "2026-12-07",
    allDay: false,
    startTime: "14:00",
    endTime: "15:00",
    location: "",
    notes: "",
    reminder: "60",
    repeatFreq: "none",
    repeatInterval: "1",
    repeatUntil: "",
  };
  it("accepts a good event", () => expect(validateEvent(ok)).toEqual({}));
  it("rejects bad titles, dates and times", () => {
    expect(validateEvent({ ...ok, title: " " }).title).toBeTruthy();
    expect(validateEvent({ ...ok, endDate: "2026-12-06" }).endDate).toBeTruthy();
    expect(validateEvent({ ...ok, endTime: "13:00" }).endTime).toBeTruthy();
    expect(validateEvent({ ...ok, endDate: "2026-12-08", endTime: "13:00" })).toEqual({});
    expect(validateEvent({ ...ok, allDay: true, startTime: "", endTime: "" })).toEqual({});
    expect(validateEvent({ ...ok, startTime: "" }).startTime).toBeTruthy();
  });
  it("rejects bad category, color and reminder", () => {
    expect(validateEvent({ ...ok, category: "teaching_session" }).category).toBeTruthy();
    expect(validateEvent({ ...ok, color: "pink" }).color).toBeTruthy();
    expect(validateEvent({ ...ok, reminder: "7" }).reminder).toBeTruthy();
  });
  it("validates repeating", () => {
    const rep = { ...ok, repeatFreq: "weekly", repeatUntil: "2027-03-01" };
    expect(validateEvent(rep)).toEqual({});
    expect(validateEvent({ ...rep, repeatUntil: "" }).repeatUntil).toBeTruthy();
    expect(validateEvent({ ...rep, repeatUntil: "2026-12-01" }).repeatUntil).toBeTruthy();
    expect(validateEvent({ ...rep, repeatUntil: "2029-01-01" }).repeatUntil).toMatch(/two years/);
    expect(validateEvent({ ...rep, repeatInterval: "0" }).repeatInterval).toBeTruthy();
    expect(validateEvent({ ...rep, repeatFreq: "yearly" }).repeatFreq).toBeTruthy();
  });
  it("skips series-level checks for a single occurrence", () => {
    expect(
      validateEvent(
        { ...ok, category: "", reminder: "x", repeatFreq: "weekly", repeatUntil: "" },
        true,
      ),
    ).toEqual({});
  });
});
