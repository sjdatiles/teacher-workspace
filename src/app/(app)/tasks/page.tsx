import { CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import {
  DUE_FILTERS,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_SORTS,
  TASK_STATUSES,
  type DueFilter,
  type TaskSort,
  type TaskView,
} from "@/features/tasks/constants";
import { sortTasks } from "@/features/tasks/rules";
import { TaskBoard } from "@/features/tasks/TaskBoard";
import { getAcademicContext } from "@/services/academic";
import { TASK_FETCH_LIMIT, getTaskCounts, getTasks } from "@/services/tasks";

export const metadata: Metadata = { title: "Tasks & Responsibilities" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const PAGE_SIZE = 25;

export default async function TasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { today } = await getAcademicContext();

  const view: TaskView = one(sp.view) === "board" ? "board" : "list";
  const q = one(sp.q).trim().slice(0, 100);
  const category = TASK_CATEGORIES.some((c) => c.value === one(sp.category))
    ? one(sp.category)
    : "";
  const priority = TASK_PRIORITIES.some((p) => p.value === one(sp.priority))
    ? one(sp.priority)
    : "";
  // The board already groups by status, so the status filter only applies to the list.
  const status =
    view === "list" && TASK_STATUSES.some((s) => s.value === one(sp.status)) ? one(sp.status) : "";
  const due = (DUE_FILTERS.some((d) => d.value === one(sp.due)) ? one(sp.due) : "") as DueFilter;
  const sort = (
    TASK_SORTS.some((s) => s.value === one(sp.sort)) ? one(sp.sort) : "due"
  ) as TaskSort;
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);

  const [{ tasks, truncated }, counts] = await Promise.all([
    getTasks({ q, category, status, priority, due, today }),
    getTaskCounts(today),
  ]);

  const sorted = sortTasks(tasks, sort);
  const shown = view === "list" ? sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : sorted;
  const filtered = Boolean(q || category || priority || status || due);

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const all = {
      view,
      q,
      category,
      priority,
      status,
      due,
      sort: sort === "due" ? "" : sort,
      ...over,
    };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return `/tasks?${p}`;
  };

  const strip = [
    {
      label: "To Do",
      value: counts.todo,
      to: href({ view: "list", status: "todo", due: "", page: "" }),
    },
    {
      label: "In Progress",
      value: counts.in_progress,
      to: href({ view: "list", status: "in_progress", due: "", page: "" }),
    },
    {
      label: "For Review",
      value: counts.for_review,
      to: href({ view: "list", status: "for_review", due: "", page: "" }),
    },
    {
      label: "Completed",
      value: counts.completed,
      to: href({ view: "list", status: "completed", due: "", page: "" }),
    },
    {
      label: "Overdue",
      value: counts.overdue,
      to: href({ view: "list", status: "", due: "overdue", page: "" }),
      danger: counts.overdue > 0,
    },
  ];

  const first = sorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, sorted.length);

  return (
    <>
      <PageHeader
        title="Tasks & Responsibilities"
        description="Stay organized and get things done, one task at a time."
        icon={CheckSquare}
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {strip.map((s) => (
          <Link key={s.label} href={s.to} className="focus-visible:outline-brand-500 rounded-card">
            <Card className="hover:border-brand-300 border border-transparent p-4 transition-colors">
              <dt className="text-ink-soft text-xs font-semibold">{s.label}</dt>
              <dd
                className={clsx(
                  "mt-1 text-2xl font-extrabold",
                  s.danger ? "text-danger-500" : "text-ink",
                )}
              >
                {s.value}
              </dd>
            </Card>
          </Link>
        ))}
      </dl>

      <Card className="mb-4 space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Task view" className="bg-brand-50 rounded-control flex p-1">
            {(["list", "board"] as const).map((v) => (
              <Link
                key={v}
                href={href({ view: v, page: "" })}
                aria-current={v === view ? "page" : undefined}
                className={clsx(
                  "rounded-lg px-3.5 py-1.5 text-sm font-semibold",
                  v === view ? "text-brand-700 bg-white shadow-sm" : "text-ink-soft hover:text-ink",
                )}
              >
                {v === "list" ? "List" : "Board"}
              </Link>
            ))}
          </div>
        </div>
        <form method="get" action="/tasks" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="view" value={view} />
          <div className="space-y-1.5 lg:col-span-2">
            <label htmlFor="task-q" className="text-ink block text-sm font-semibold">
              Search tasks
            </label>
            <input
              id="task-q"
              name="q"
              defaultValue={q}
              placeholder="Title, description or notes"
              className="rounded-control bg-surface border-line text-ink placeholder:text-ink-faint focus:border-brand-400 focus:ring-brand-200 h-11 w-full border px-3.5 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <SelectField
            label="Category"
            name="category"
            defaultValue={category}
            placeholder="All categories"
            options={TASK_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <SelectField
            label="Priority"
            name="priority"
            defaultValue={priority}
            placeholder="Any priority"
            options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
          />
          {view === "list" && (
            <SelectField
              label="Status"
              name="status"
              defaultValue={status}
              placeholder="Any status"
              options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          )}
          <SelectField
            label="Due"
            name="due"
            defaultValue={due}
            placeholder="Any time"
            options={DUE_FILTERS.map((d) => ({ value: d.value, label: d.label }))}
          />
          <SelectField
            label="Sort by"
            name="sort"
            defaultValue={sort}
            options={TASK_SORTS.map((s) => ({ value: s.value, label: s.label }))}
          />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary">
              Apply
            </Button>
            {(filtered || sort !== "due") && (
              <Link
                href={`/tasks?view=${view}`}
                className="text-brand-700 flex h-11 items-center px-2 text-sm font-semibold"
              >
                Reset
              </Link>
            )}
          </div>
        </form>
      </Card>

      {truncated && (
        <p
          role="status"
          className="rounded-control bg-warning-50 text-warning-500 mb-4 px-3.5 py-2.5 text-sm font-medium"
        >
          Showing the first {TASK_FETCH_LIMIT} matching tasks. Use the filters to narrow the list.
        </p>
      )}

      <TaskBoard
        view={view}
        tasks={shown}
        today={today}
        hasAny={counts.total > 0}
        filtered={filtered}
      />

      {view === "list" && sorted.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-ink-soft">
            Showing {first}–{last} of {sorted.length}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={href({ page: String(page - 1) })}
                className="rounded-control border-line hover:bg-brand-50 bg-surface inline-flex h-9 items-center gap-1 border px-3 font-semibold"
              >
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </Link>
            )}
            {last < sorted.length && (
              <Link
                href={href({ page: String(page + 1) })}
                className="rounded-control border-line hover:bg-brand-50 bg-surface inline-flex h-9 items-center gap-1 border px-3 font-semibold"
              >
                Next <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
