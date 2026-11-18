import { BookOpen, CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { Tabs } from "@/components/ui/Tabs";
import { NoClassDaysPanel } from "@/features/classes/NoClassDaysPanel";
import { SchedulesPanel } from "@/features/classes/SchedulesPanel";
import { SectionsPanel } from "@/features/classes/SectionsPanel";
import { SessionsPanel, type SessionFiltersView } from "@/features/classes/SessionsPanel";
import { SubjectsPanel } from "@/features/classes/SubjectsPanel";
import { formatHours } from "@/features/classes/rules";
import { SESSION_STATUSES, type SessionStatus } from "@/features/classes/constants";
import { getAcademicContext } from "@/services/academic";
import { getClassesData, getSessionTotals, getSessions } from "@/services/classes";

export const metadata: Metadata = { title: "My Classes" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const TABS = ["sessions", "schedules", "subjects", "sections", "no-class-days"] as const;
type Tab = (typeof TABS)[number];

export default async function ClassesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const openNew = one(sp.new) === "1";
  const { selectedYear, years, today } = await getAcademicContext();

  if (!selectedYear) {
    return (
      <>
        <PageHeader
          title="My Classes"
          description="Manage your subjects, sections, schedules and teaching sessions."
          icon={BookOpen}
        />
        <Card>
          <EmptyState
            icon={<CalendarRange className="size-8" aria-hidden />}
            title="Set up your academic year first"
            description="Classes belong to an academic year with three terms. Create one, and then you can add your subjects, sections and schedules."
            action={<LinkButton href="/settings#academic-years">Set up academic year</LinkButton>}
          />
        </Card>
      </>
    );
  }

  const data = await getClassesData(selectedYear.id);
  const { subjects, sections, schedules, noClassDays } = data;

  const requested = one(sp.tab) as Tab;
  const tab: Tab = (TABS as readonly string[]).includes(requested)
    ? requested
    : subjects.length === 0
      ? "subjects"
      : "sessions";

  const totals = await getSessionTotals(selectedYear.id, today);
  const totalStudents = sections.reduce((n, s) => n + s.population, 0);

  const stats = [
    { label: "Subjects", value: subjects.length },
    { label: "Sections", value: sections.length },
    { label: "Total students", value: totalStudents },
    { label: "Completed sessions", value: totals.completedSessions },
    { label: "Completed hours", value: formatHours(totals.completedMinutes) },
  ];

  const tabs = [
    { key: "sessions", label: "Sessions" },
    { key: "schedules", label: "Schedules", count: schedules.length },
    { key: "subjects", label: "Subjects", count: subjects.length },
    { key: "sections", label: "Sections", count: sections.length },
    { key: "no-class-days", label: "No-class days", count: noClassDays.length },
  ].map((t) => ({ ...t, href: `/classes?tab=${t.key}` }));

  const yearInfo = {
    startDate: selectedYear.startDate,
    endDate: selectedYear.endDate,
    terms: selectedYear.terms.map((t) => ({
      termNumber: t.termNumber,
      startDate: t.startDate,
      endDate: t.endDate,
    })),
  };

  return (
    <>
      <PageHeader
        title="My Classes"
        description={`Subjects, sections, schedules and teaching sessions for ${selectedYear.name}.`}
        icon={BookOpen}
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <dt className="text-ink-soft text-xs font-semibold">{s.label}</dt>
            <dd className="text-ink mt-1 text-2xl font-extrabold">{s.value}</dd>
          </Card>
        ))}
      </dl>

      <Tabs items={tabs} active={tab} label="My Classes sections" />

      {tab === "subjects" && (
        <SubjectsPanel
          subjects={subjects}
          sections={sections}
          otherYears={years
            .filter((y) => y.id !== selectedYear.id)
            .map((y) => ({ id: y.id, name: y.name }))}
          autoOpen={openNew}
        />
      )}
      {tab === "sections" && (
        <SectionsPanel sections={sections} subjects={subjects} autoOpen={openNew} />
      )}
      {tab === "schedules" && (
        <SchedulesPanel
          schedules={schedules}
          subjects={subjects}
          sections={sections}
          autoOpen={openNew}
          year={yearInfo}
          onGoToSubjects="/classes?tab=subjects"
        />
      )}
      {tab === "no-class-days" && <NoClassDaysPanel days={noClassDays} year={yearInfo} />}
      {tab === "sessions" && (
        <SessionsTab
          sp={sp}
          yearId={selectedYear.id}
          terms={selectedYear.terms}
          today={today}
          data={data}
          pastScheduled={totals.pastScheduled}
        />
      )}
    </>
  );
}

async function SessionsTab({
  sp,
  yearId,
  terms,
  today,
  data,
  pastScheduled,
}: {
  sp: Search;
  yearId: string;
  terms: { id: string; termNumber: number }[];
  today: string;
  data: Awaited<ReturnType<typeof getClassesData>>;
  pastScheduled: number;
}) {
  const whenRaw = one(sp.when);
  const when: SessionFiltersView["when"] =
    whenRaw === "past" || whenRaw === "all" ? whenRaw : "upcoming";
  const termRaw = one(sp.term);
  const term = ["1", "2", "3"].includes(termRaw) ? termRaw : "";
  const statusRaw = one(sp.status);
  const status = SESSION_STATUSES.some((s) => s.value === statusRaw) ? statusRaw : "";
  const subjectId = data.subjects.some((s) => s.id === one(sp.subject)) ? one(sp.subject) : "";
  const sectionId = data.sections.some((s) => s.id === one(sp.section)) ? one(sp.section) : "";
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);

  const result = await getSessions(yearId, new Map(terms.map((t) => [t.id, t.termNumber])), today, {
    when,
    term: term ? Number(term) : null,
    status: (status || null) as SessionStatus | null,
    subjectId: subjectId || null,
    sectionId: sectionId || null,
    page,
  });

  return (
    <SessionsPanel
      rows={result.rows}
      total={result.total}
      pageSize={result.pageSize}
      page={page}
      filters={{ when, term, status, subjectId, sectionId }}
      subjects={data.subjects}
      sections={data.sections}
      today={today}
      pastScheduled={pastScheduled}
      hasSchedules={data.schedules.length > 0}
      canAddManual={data.subjects.some((s) => s.sectionIds.length > 0)}
      autoOpen={one(sp.new) === "1"}
    />
  );
}
