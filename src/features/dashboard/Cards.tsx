import clsx from "clsx";
import { ArrowRight, CheckSquare } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { COLOR_CLASSES, categoryLabel, type ColorKey } from "@/features/calendar/constants";
import { itemTimeLabel } from "@/features/calendar/items";
import type { CalendarItem } from "@/features/calendar/types";
import { statusMeta } from "@/features/classes/constants";
import { StackedBars, TermLegend } from "@/features/reports/Charts";
import { formatHours } from "@/features/reports/rules";
import { priorityMeta } from "@/features/tasks/constants";
import { dueLabel, isOverdue } from "@/features/tasks/rules";
import { formatDate } from "@/lib/time";
import type { DashboardData } from "@/services/dashboard";

const dot = (color: string) => COLOR_CLASSES[color as ColorKey]?.dot ?? "bg-ink-faint";

function CardTitle({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-ink text-base font-bold">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-brand-700 inline-flex items-center gap-1 text-xs font-bold hover:underline"
        >
          {link ?? "View all"} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-ink-soft py-4 text-sm">{children}</p>
);

export function StatsStrip({ stats }: { stats: DashboardData["stats"] }) {
  const tiles = [
    { label: "Subjects", value: stats.subjects, href: "/classes?tab=subjects" },
    { label: "Class sections", value: stats.sections, href: "/classes?tab=sections" },
    {
      label: "Students (all sections)",
      value: stats.students.toLocaleString("en-US"),
      href: "/classes?tab=sections",
    },
    {
      label: "Completed sessions",
      value: stats.totals.completedSessions,
      href: "/reports?period=year",
    },
    {
      label: "Completed hours",
      value: formatHours(stats.totals.completedMinutes),
      href: "/reports?period=year",
    },
    { label: "Pending tasks", value: stats.pendingTasks, href: "/tasks" },
  ];
  return (
    <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href} className="focus-visible:outline-brand-500 rounded-card">
          <Card className="hover:border-brand-300 h-full border border-transparent p-4 transition-colors">
            <dt className="text-ink-soft text-xs font-semibold">{t.label}</dt>
            <dd className="text-ink mt-1 text-2xl font-extrabold tabular-nums">{t.value}</dd>
          </Card>
        </Link>
      ))}
    </dl>
  );
}

export function MyDay({ items, today }: { items: CalendarItem[]; today: string }) {
  const noClass = items.filter((i) => i.kind === "noclass");
  const rest = items.filter((i) => i.kind !== "noclass");
  return (
    <Card className="p-4 sm:p-5">
      <CardTitle
        title="Today's schedule"
        href={`/calendar?view=day&date=${today}`}
        link="Open day"
      />
      <p className="text-ink-faint -mt-2 mb-3 text-xs">{formatDate(today)}</p>
      {noClass.map((n) => (
        <p
          key={n.key}
          className="bg-warning-50 text-warning-500 rounded-control mb-3 px-3 py-2 text-sm font-semibold"
        >
          No class today: {n.title}
        </p>
      ))}
      {rest.length === 0 ? (
        <Empty>Nothing scheduled for today.</Empty>
      ) : (
        <ul className="divide-line divide-y">
          {rest.map((i) => {
            const dimmed = i.status === "cancelled" || i.status === "rescheduled";
            return (
              <li key={i.key} className="flex items-start gap-3 py-3">
                <span
                  className={clsx("mt-1.5 size-2.5 shrink-0 rounded-full", dot(i.color))}
                  aria-hidden
                />
                <Link
                  href={
                    i.kind === "session"
                      ? "/classes?tab=sessions"
                      : `/calendar?view=day&date=${today}`
                  }
                  className="min-w-0 flex-1"
                >
                  <p
                    className={clsx(
                      "text-ink text-sm font-bold",
                      dimmed && "text-ink-soft line-through",
                    )}
                  >
                    {i.title}
                  </p>
                  <p className="text-ink-soft text-xs">
                    {itemTimeLabel(i)}
                    {i.kind === "session"
                      ? ` · ${i.subtitle.split(" · ")[0]}`
                      : i.subtitle
                        ? ` · ${i.subtitle}`
                        : ""}
                  </p>
                </Link>
                {i.kind === "session" && i.status ? (
                  <Badge tone={statusMeta(i.status).tone}>{statusMeta(i.status).label}</Badge>
                ) : (
                  <Badge tone="neutral">{categoryLabel(i.category)}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function UpcomingCard({ items }: { items: CalendarItem[] }) {
  return (
    <Card className="p-4 sm:p-5">
      <CardTitle title="Upcoming activities" href="/calendar" />
      {items.length === 0 ? (
        <Empty>No upcoming sessions or events in the next 30 days.</Empty>
      ) : (
        <ul className="divide-line divide-y">
          {items.map((i) => (
            <li key={i.key}>
              <Link
                href={`/calendar?view=day&date=${i.startDate}`}
                className="hover:bg-brand-50/60 flex items-center gap-3 rounded-lg py-2.5"
              >
                <span className="bg-canvas flex size-12 shrink-0 flex-col items-center justify-center rounded-lg leading-tight">
                  <span className="text-ink-soft text-[10px] font-bold uppercase">
                    {formatDate(i.startDate).split(" ")[0]}
                  </span>
                  <span className="text-ink text-lg font-extrabold">
                    {Number(i.startDate.slice(8, 10))}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={clsx("size-2 shrink-0 rounded-full", dot(i.color))}
                      aria-hidden
                    />
                    <span className="text-ink truncate text-sm font-bold">{i.title}</span>
                  </span>
                  <span className="text-ink-soft block truncate text-xs">
                    {itemTimeLabel(i)} ·{" "}
                    {i.kind === "session" ? i.subtitle : categoryLabel(i.category)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TasksCard({ data, today }: { data: DashboardData; today: string }) {
  const c = data.taskCounts;
  const chips = [
    { label: "To Do", value: c.todo, href: "/tasks?status=todo", tone: "neutral" as const },
    {
      label: "In Progress",
      value: c.in_progress,
      href: "/tasks?status=in_progress",
      tone: "info" as const,
    },
    {
      label: "For Review",
      value: c.for_review,
      href: "/tasks?status=for_review",
      tone: "violet" as const,
    },
    {
      label: "Completed",
      value: c.completed,
      href: "/tasks?status=completed",
      tone: "success" as const,
    },
    {
      label: "Overdue",
      value: c.overdue,
      href: "/tasks?due=overdue",
      tone: c.overdue > 0 ? ("danger" as const) : ("neutral" as const),
    },
  ];
  return (
    <Card className="p-4 sm:p-5">
      <CardTitle title="Tasks & responsibilities" href="/tasks" />
      <ul className="mb-3 flex flex-wrap gap-2">
        {chips.map((k) => (
          <li key={k.label}>
            <Link href={k.href} className="inline-flex items-center gap-1.5">
              <Badge tone={k.tone}>
                {k.label} · {k.value}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
      {data.openTasks.length === 0 ? (
        <Empty>
          {c.total === 0 ? "No tasks yet. Add one to get started." : "No open tasks. Nice work!"}
        </Empty>
      ) : (
        <ul className="divide-line divide-y">
          {data.openTasks.map((t) => {
            const pr = priorityMeta(t.priority);
            const overdue =
              t.status !== "completed" && isOverdue({ status: "todo", dueDate: t.dueDate }, today);
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <CheckSquare className="text-ink-faint size-4 shrink-0" aria-hidden />
                <Link href="/tasks" className="min-w-0 flex-1">
                  <p className="text-ink truncate text-sm font-semibold">{t.title}</p>
                  <p
                    className={clsx(
                      "text-xs",
                      overdue ? "text-danger-500 font-semibold" : "text-ink-soft",
                    )}
                  >
                    {dueLabel(t.dueDate, today, formatDate)}
                  </p>
                </Link>
                <Badge tone={pr.tone}>{pr.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Donut({ percent }: { percent: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 128 128"
      className="size-32 shrink-0"
      role="img"
      aria-label={`${percent}% of planned sessions completed`}
    >
      <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" className="stroke-brand-100" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        strokeWidth="12"
        strokeLinecap="round"
        className="stroke-brand-500"
        strokeDasharray={`${(percent / 100) * circ} ${circ}`}
        transform="rotate(-90 64 64)"
      />
      <text
        x="64"
        y="64"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-ink text-[26px] font-extrabold"
      >
        {percent}%
      </text>
    </svg>
  );
}

export function ProgressCard({ progress }: { progress: DashboardData["progress"] }) {
  const { report, planned, completed, label } = progress;
  const percent = planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : 0;
  const top = (g: typeof report.sections) =>
    [...g].sort((a, b) => b.total.sessions - a.total.sessions).slice(0, 4);
  return (
    <Card className="p-4 sm:p-5">
      <CardTitle title={`Teaching progress · ${label}`} href="/reports" link="Full report" />
      {planned === 0 && completed === 0 ? (
        <Empty>
          No sessions yet for this period. Add a schedule in My Classes and sessions will appear
          here.
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5">
            <Donut percent={percent} />
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="text-ink font-bold">
                {completed} of {planned} planned sessions completed
              </p>
              <p className="text-ink-soft">
                {formatHours(report.totals.minutes)} teaching hours completed
              </p>
              <p className="text-ink-faint text-xs">
                Cancelled and rescheduled sessions are not counted as planned.
              </p>
            </div>
          </div>
          {report.subjects.length > 0 && (
            <div className="mt-5 space-y-5">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-ink text-sm font-bold">Completed by subject</h3>
                  <TermLegend />
                </div>
                <StackedBars groups={top(report.subjects)} measure="sessions" />
              </div>
              <div>
                <h3 className="text-ink mb-2 text-sm font-bold">Completed by section</h3>
                <StackedBars groups={top(report.sections)} measure="sessions" />
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
