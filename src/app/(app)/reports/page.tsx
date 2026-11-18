import clsx from "clsx";
import { BarChart3, Download, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectField } from "@/components/ui/SelectField";
import { StackedBars, TermColumns, TermLegend } from "@/features/reports/Charts";
import { GroupTable } from "@/features/reports/GroupTable";
import { PrintButton } from "@/features/reports/PrintButton";
import { PERIODS, formatHours } from "@/features/reports/rules";
import { getAcademicContext } from "@/services/academic";
import { getClassesData } from "@/services/classes";
import { getReport, parseReportRequest } from "@/services/reports";

export const metadata: Metadata = { title: "Reports & Accomplishments" };

type Search = Record<string, string | string[] | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { selectedYear, activeTerm } = await getAcademicContext();

  if (!selectedYear) {
    return (
      <>
        <PageHeader
          title="Reports & Accomplishments"
          description="Track your teaching progress across Term 1, Term 2 and Term 3."
          icon={BarChart3}
        />
        <Card>
          <EmptyState
            icon={<BarChart3 className="size-8" aria-hidden />}
            title="Set up an academic year first"
            description="Reports are organized by the three terms of your academic year."
            action={
              <Link href="/settings" className="text-brand-700 font-bold hover:underline">
                Go to Settings
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const req = await parseReportRequest(sp, selectedYear.id, activeTerm?.termNumber ?? null);
  const [report, classes] = await Promise.all([getReport(req), getClassesData(selectedYear.id)]);

  const params = (over: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    const all: Record<string, string> = {
      period: req.period,
      subject: req.subject,
      section: req.section,
      from: req.from,
      to: req.to,
      ...over,
    };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return p.toString();
  };
  const exportHref = `/reports/export?${params()}`;
  const hasData = report.totals.sessions > 0;

  return (
    <>
      <PageHeader
        title="Reports & Accomplishments"
        description="Track your teaching progress across Term 1, Term 2 and Term 3."
        icon={BarChart3}
      />

      <div className="mb-4 hidden print:block">
        <h2 className="text-lg font-bold">Teaching accomplishment report — {selectedYear.name}</h2>
        <p className="text-sm">
          {report.periodLabel} · {report.subjectLabel} · {report.sectionLabel} · completed sessions
          only
        </p>
      </div>

      <Card className="mb-4 space-y-4 p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Report period"
            className="bg-brand-50 rounded-control flex flex-wrap p-1"
          >
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/reports?${params({ period: p.key, ...(p.key === "range" ? {} : { from: "", to: "" }) })}`}
                aria-current={p.key === req.period ? "page" : undefined}
                className={clsx(
                  "rounded-lg px-3.5 py-1.5 text-sm font-semibold",
                  p.key === req.period
                    ? "text-brand-700 bg-white shadow-sm"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <PrintButton />
            <a
              href={exportHref}
              download
              className="border-line hover:bg-brand-50 rounded-control bg-surface inline-flex h-9 items-center gap-1.5 border px-3 text-sm font-bold"
            >
              <Download className="size-4" aria-hidden /> Export CSV
            </a>
          </div>
        </div>

        <form method="get" action="/reports" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="period" value={req.period} />
          {req.period === "range" && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="rep-from" className="text-ink block text-sm font-semibold">
                  From
                </label>
                <input
                  id="rep-from"
                  type="date"
                  name="from"
                  defaultValue={req.from}
                  className="rounded-control bg-surface border-line text-ink focus:border-brand-400 focus:ring-brand-200 h-11 w-full border px-3 text-sm focus:ring-2 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rep-to" className="text-ink block text-sm font-semibold">
                  To
                </label>
                <input
                  id="rep-to"
                  type="date"
                  name="to"
                  defaultValue={req.to}
                  className="rounded-control bg-surface border-line text-ink focus:border-brand-400 focus:ring-brand-200 h-11 w-full border px-3 text-sm focus:ring-2 focus:outline-none"
                />
              </div>
            </>
          )}
          <SelectField
            label="Subject"
            name="subject"
            defaultValue={req.subject}
            placeholder="All subjects"
            options={classes.subjects.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.gradeLevel})`,
            }))}
          />
          <SelectField
            label="Section"
            name="section"
            defaultValue={req.section}
            placeholder="All sections"
            options={classes.sections.map((s) => ({
              value: s.id,
              label: `${s.gradeLevel} – ${s.name}`,
            }))}
          />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary">
              Apply
            </Button>
            {(req.subject || req.section || req.from || req.to) && (
              <Link
                href={`/reports?period=${req.period}`}
                className="text-brand-700 flex h-11 items-center px-2 text-sm font-semibold"
              >
                Reset
              </Link>
            )}
          </div>
        </form>
        {req.rangeError && (
          <p
            role="alert"
            className="rounded-control bg-danger-50 text-danger-500 px-3.5 py-2.5 text-sm font-medium"
          >
            {req.rangeError}
          </p>
        )}
      </Card>

      <dl className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Sessions conducted",
            value: String(report.totals.sessions),
            hint: "Completed sessions",
          },
          {
            label: "Total teaching hours",
            value: formatHours(report.totals.minutes),
            hint: "From recorded actual durations",
          },
          {
            label: "Total students taught",
            value: report.totals.students.toLocaleString("en-US"),
            hint: "Section population at each completed session",
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <dt className="text-ink-soft text-xs font-semibold">{s.label}</dt>
            <dd className="text-ink mt-1 text-3xl font-extrabold tabular-nums">{s.value}</dd>
            <p className="text-ink-faint mt-1 text-xs">{s.hint}</p>
          </Card>
        ))}
      </dl>

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<BarChart3 className="size-8" aria-hidden />}
            title={
              req.rangeError ? "Fix the dates to see the report" : "No completed sessions here yet"
            }
            description="Reports count only teaching sessions marked Completed. Scheduled, cancelled and rescheduled sessions are not included."
            action={
              <Link href="/classes" className="text-brand-700 font-bold hover:underline">
                Open My Classes
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="text-ink mb-4 text-base font-bold">Term comparison</h2>
            <div className="grid gap-8 md:grid-cols-2">
              <TermColumns
                title="Completed sessions"
                unit="sessions"
                format={String}
                data={report.terms.map((t) => ({ term: t.term, value: t.sessions }))}
              />
              <TermColumns
                title="Teaching hours"
                unit="hours"
                format={formatHours}
                data={report.terms.map((t) => ({ term: t.term, value: t.minutes }))}
              />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-ink text-base font-bold">Sessions per section</h2>
                <TermLegend />
              </div>
              <StackedBars groups={report.sections} measure="sessions" />
            </Card>
            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-ink text-base font-bold">Sessions per subject</h2>
                <TermLegend />
              </div>
              <StackedBars groups={report.subjects} measure="sessions" />
            </Card>
          </div>

          <Card className="p-4 sm:p-5">
            <h2 className="text-ink mb-3 text-base font-bold">Completed sessions per section</h2>
            <GroupTable
              title="Completed sessions per section by term"
              firstColumn="Section"
              groups={report.sections}
            />
          </Card>
          <Card className="p-4 sm:p-5">
            <h2 className="text-ink mb-3 text-base font-bold">Completed sessions per subject</h2>
            <GroupTable
              title="Completed sessions per subject by term"
              firstColumn="Subject"
              groups={report.subjects}
            />
          </Card>
        </div>
      )}

      <p className="bg-brand-50 text-ink-soft rounded-control mt-6 flex items-start gap-2 px-4 py-3 text-sm">
        <Info className="text-brand-600 mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="text-ink">3-term curriculum.</strong> Reports are organized by Term 1,
          Term 2 and Term 3 of {selectedYear.name}. Only sessions marked Completed are counted;
          tasks, meetings and other events never are.
        </span>
      </p>
    </>
  );
}
