import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/time";
import { dueLabel, isOverdue, matchesDue, sortTasks, validateTask, type TaskInput } from "./rules";
import type { Task } from "./types";

const t = (over: Partial<Task> = {}): Task => ({
  id: "1",
  title: "Task",
  description: "",
  category: "teaching",
  status: "todo",
  priority: "medium",
  dueDate: null,
  notes: "",
  completedAt: null,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  ...over,
});
const today = "2026-11-17";

describe("validateTask", () => {
  const ok: TaskInput = {
    title: "Grade quizzes",
    description: "",
    category: "teaching",
    status: "todo",
    priority: "high",
    dueDate: "2026-11-20",
    notes: "",
  };
  it("accepts a valid task, with or without a due date", () => {
    expect(validateTask(ok)).toEqual({});
    expect(validateTask({ ...ok, dueDate: "" })).toEqual({});
  });
  it("rejects bad values", () => {
    expect(validateTask({ ...ok, title: " " }).title).toBeTruthy();
    expect(validateTask({ ...ok, title: "x".repeat(161) }).title).toBeTruthy();
    expect(validateTask({ ...ok, category: "homework" }).category).toBeTruthy();
    expect(validateTask({ ...ok, status: "done" }).status).toBeTruthy();
    expect(validateTask({ ...ok, priority: "critical" }).priority).toBeTruthy();
    expect(validateTask({ ...ok, dueDate: "2026-02-30" }).dueDate).toBeTruthy();
  });
  it("accepts Urgent and all five categories", () => {
    expect(validateTask({ ...ok, priority: "urgent" })).toEqual({});
    for (const c of ["teaching", "administrative", "school_activities", "personal", "other"])
      expect(validateTask({ ...ok, category: c })).toEqual({});
  });
});

describe("overdue and due filters", () => {
  it("is overdue only when past due and not completed", () => {
    expect(isOverdue(t({ dueDate: "2026-11-16" }), today)).toBe(true);
    expect(isOverdue(t({ dueDate: "2026-11-17" }), today)).toBe(false);
    expect(isOverdue(t({ dueDate: "2026-11-16", status: "completed" }), today)).toBe(false);
    expect(isOverdue(t({ dueDate: null }), today)).toBe(false);
    expect(isOverdue(t({ dueDate: "2026-11-01", status: "for_review" }), today)).toBe(true);
  });
  it("filters by due date", () => {
    expect(matchesDue(t({ dueDate: "2026-11-17" }), "today", today)).toBe(true);
    expect(matchesDue(t({ dueDate: "2026-11-24" }), "week", today)).toBe(true);
    expect(matchesDue(t({ dueDate: "2026-11-25" }), "week", today)).toBe(false);
    expect(matchesDue(t({ dueDate: "2026-11-16" }), "week", today)).toBe(false);
    expect(matchesDue(t({ dueDate: null }), "none", today)).toBe(true);
    expect(matchesDue(t({ dueDate: "2026-11-01" }), "", today)).toBe(true);
  });
});

describe("sortTasks", () => {
  const tasks = [
    t({
      id: "a",
      title: "B",
      dueDate: null,
      priority: "urgent",
      createdAt: "2026-11-03T00:00:00Z",
    }),
    t({
      id: "b",
      title: "A",
      dueDate: "2026-11-20",
      priority: "low",
      createdAt: "2026-11-02T00:00:00Z",
    }),
    t({
      id: "c",
      title: "C",
      dueDate: "2026-11-18",
      priority: "high",
      createdAt: "2026-11-01T00:00:00Z",
    }),
  ];
  it("sorts by due date with undated last", () =>
    expect(sortTasks(tasks, "due").map((x) => x.id)).toEqual(["c", "b", "a"]));
  it("sorts by priority, urgent first", () =>
    expect(sortTasks(tasks, "priority").map((x) => x.id)).toEqual(["a", "c", "b"]));
  it("sorts newest first and by title", () => {
    expect(sortTasks(tasks, "newest").map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(sortTasks(tasks, "title").map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
  it("does not change the input", () => {
    const copy = [...tasks];
    sortTasks(tasks, "title");
    expect(tasks).toEqual(copy);
  });
});

describe("dueLabel", () => {
  it("describes due dates", () => {
    expect(dueLabel(null, today, formatDate)).toBe("No due date");
    expect(dueLabel("2026-11-17", today, formatDate)).toBe("Due today");
    expect(dueLabel("2026-11-18", today, formatDate)).toBe("Due tomorrow");
    expect(dueLabel("2026-11-16", today, formatDate)).toBe("1 day overdue");
    expect(dueLabel("2026-11-14", today, formatDate)).toBe("3 days overdue");
    expect(dueLabel("2026-12-05", today, formatDate)).toBe("Due Dec 5, 2026");
  });
});
