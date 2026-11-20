import { CalendarRange, Home } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import {
  MyDay,
  ProgressCard,
  StatsStrip,
  TasksCard,
  UpcomingCard,
} from "@/features/dashboard/Cards";
import { MiniCalendar } from "@/features/dashboard/MiniCalendar";
import { QuickActions } from "@/features/dashboard/QuickActions";
import { nowInSchool } from "@/lib/time";
import { getAcademicContext } from "@/services/academic";
import { getDashboard } from "@/services/dashboard";
import { requireTeacher } from "@/services/teacher";

export const metadata: Metadata = { title: "Home" };

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const teacher = await requireTeacher();
  const { selectedYear, activeTerm, today } = await getAcademicContext();

  const hour = Math.floor(nowInSchool().minutes / 60);
  const firstName = (teacher.fullName || teacher.email).split(/[\s@]/)[0];
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));

  const data = selectedYear
    ? await getDashboard({
        yearId: selectedYear.id,
        today,
        activeTermId: activeTerm?.id ?? null,
        activeTermNumber: activeTerm?.termNumber ?? null,
      })
    : null;

  return (
    <>
      <PageHeader title={`${greeting(hour)}, ${firstName}!`} description={todayLabel} icon={Home} />

      <QuickActions hasYear={Boolean(selectedYear)} />

      {!selectedYear || !data ? (
        <Card>
          <EmptyState
            icon={<CalendarRange className="size-8" aria-hidden />}
            title="Start by setting up your academic year"
            description="Your workspace is organized by academic year and its three terms. Add the dates for yours and the rest of Manunudlo will follow."
            action={
              <LinkButton href="/settings#academic-years">
                <CalendarRange className="size-4" aria-hidden /> Set up academic year
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <>
          <StatsStrip stats={data.stats} />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <MyDay items={data.today} today={today} />
            <Card className="p-4 sm:p-5">
              <h2 className="text-ink mb-3 text-base font-bold">Calendar</h2>
              <MiniCalendar today={today} items={data.month} />
            </Card>
            <div className="lg:col-span-2 xl:col-span-1">
              <UpcomingCard items={data.upcoming} />
            </div>
            <div className="lg:col-span-1 xl:col-span-1">
              <TasksCard data={data} today={today} />
            </div>
            <div className="lg:col-span-1 xl:col-span-2">
              <ProgressCard progress={data.progress} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
