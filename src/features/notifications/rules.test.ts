import { describe, expect, it } from "vitest";
import type { CalendarItem } from "@/features/calendar/types";
import { buildNotifications, type Prefs } from "./rules";

const all: Prefs = { upcomingSessions: true, upcomingEvents: true, taskDeadlines: true };
const now = { date: "2026-11-18", minutes: 8 * 60 }; // Wed 8:00 AM

const session = (
  id: string,
  date: string,
  start: string,
  end: string,
  status = "scheduled",
): CalendarItem => ({
  key: `session:${id}`,
  kind: "session",
  title: "Math",
  subtitle: "Rose",
  startDate: date,
  endDate: date,
  startTime: start,
  endTime: end,
  category: "teaching_schedule",
  color: "x",
  status,
  sessionId: id,
});
const event = (
  id: string,
  o: Partial<CalendarItem> & { reminder: number | null },
): CalendarItem => ({
  key: `event:${id}:${o.startDate ?? "2026-11-18"}`,
  kind: "event",
  title: "Meeting",
  subtitle: "",
  startDate: "2026-11-18",
  endDate: o.endDate ?? o.startDate ?? "2026-11-18",
  startTime: "14:00",
  endTime: "15:00",
  category: "meeting",
  color: "x",
  occurrence: {} as never,
  event: { reminderMinutes: o.reminder } as never,
  ...o,
});

describe("session notifications", () => {
  it("includes scheduled sessions today (not yet ended) and tomorrow", () => {
    const n = buildNotifications(
      [session("a", "2026-11-18", "09:00", "10:00"), session("b", "2026-11-19", "08:00", "09:00")],
      [],
      all,
      now,
    );
    expect(n.map((x) => x.key)).toEqual(["session:a", "session:b"]);
    expect(n[0].message).toBe("Today, 9:00 AM – 10:00 AM");
    expect(n[1].message).toBe("Tomorrow, 8:00 AM – 9:00 AM");
  });
  it("skips ended, non-scheduled and far-away sessions", () => {
    const n = buildNotifications(
      [
        session("ended", "2026-11-18", "06:00", "07:00"),
        session("done", "2026-11-18", "09:00", "10:00", "completed"),
        session("x", "2026-11-18", "09:00", "10:00", "cancelled"),
        session("far", "2026-11-20", "09:00", "10:00"),
      ],
      [],
      all,
      now,
    );
    expect(n).toEqual([]);
  });
  it("keeps a session that is in progress", () => {
    expect(
      buildNotifications([session("a", "2026-11-18", "07:30", "08:30")], [], all, now),
    ).toHaveLength(1);
  });
});

describe("event notifications", () => {
  it("fires only inside the reminder window", () => {
    const e = event("e", { reminder: 60 }); // 2:00 PM, 1 hour before = 1:00 PM
    expect(buildNotifications([e], [], all, now)).toEqual([]);
    const n = buildNotifications([e], [], all, { date: "2026-11-18", minutes: 13 * 60 + 30 });
    expect(n).toHaveLength(1);
    expect(n[0].message).toBe("Starts today at 2:00 PM");
  });
  it("says happening now during the event, and stops after it ends", () => {
    const e = event("e", { reminder: 0 });
    expect(
      buildNotifications([e], [], all, { date: "2026-11-18", minutes: 14 * 60 + 10 })[0].message,
    ).toBe("Happening now");
    expect(buildNotifications([e], [], all, { date: "2026-11-18", minutes: 15 * 60 })).toEqual([]);
  });
  it("never fires without a reminder", () => {
    expect(
      buildNotifications([event("e", { reminder: null })], [], all, {
        date: "2026-11-18",
        minutes: 14 * 60,
      }),
    ).toEqual([]);
  });
  it("handles a one-day-before reminder for an all-day event tomorrow", () => {
    const e = event("e", {
      reminder: 1440,
      startDate: "2026-11-19",
      endDate: "2026-11-19",
      startTime: null,
      endTime: null,
    });
    const n = buildNotifications([e], [], all, now);
    expect(n[0].message).toBe("All day tomorrow");
  });
  it("shows a multi-day event on later days until it ends", () => {
    const e = event("e", {
      reminder: 0,
      startDate: "2026-11-17",
      endDate: "2026-11-19",
      startTime: null,
      endTime: null,
    });
    expect(buildNotifications([e], [], all, now)).toHaveLength(1);
    expect(buildNotifications([e], [], all, { date: "2026-11-20", minutes: 600 })).toEqual([]);
  });
});

describe("task notifications", () => {
  const tasks = [
    { id: "t1", title: "Old", dueDate: "2026-11-10", priority: "high" },
    { id: "t2", title: "Today", dueDate: "2026-11-18", priority: "low" },
    { id: "t3", title: "Tomorrow", dueDate: "2026-11-19", priority: "low" },
    { id: "t4", title: "Later", dueDate: "2026-11-25", priority: "low" },
  ];
  it("separates overdue, due today and due tomorrow, and ignores later tasks", () => {
    const n = buildNotifications([], tasks, all, now);
    expect(n.map((x) => x.key)).toEqual([
      "task-overdue:t1",
      "task-due:t2:2026-11-18",
      "task-due:t3:2026-11-19",
    ]);
    expect(n[0].message).toContain("Overdue by 8 days");
    expect(n[1].message).toBe("Due today");
  });
  it("caps overdue notifications", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: `o${i}`,
      title: `T${i}`,
      dueDate: "2026-11-01",
      priority: "low",
    }));
    expect(buildNotifications([], many, all, now)).toHaveLength(10);
  });
});

describe("preferences", () => {
  it("each group can be switched off", () => {
    const items = [session("a", "2026-11-18", "09:00", "10:00"), event("e", { reminder: 600 })];
    const tasks = [{ id: "t", title: "T", dueDate: "2026-11-18", priority: "low" }];
    expect(
      buildNotifications(
        items,
        tasks,
        { upcomingSessions: false, upcomingEvents: false, taskDeadlines: false },
        now,
      ),
    ).toEqual([]);
    expect(
      buildNotifications(items, tasks, { ...all, upcomingSessions: false }, now).some(
        (n) => n.kind === "session",
      ),
    ).toBe(false);
    expect(
      buildNotifications(items, tasks, { ...all, taskDeadlines: false }, now).some(
        (n) => n.kind === "deadline",
      ),
    ).toBe(false);
  });
});
