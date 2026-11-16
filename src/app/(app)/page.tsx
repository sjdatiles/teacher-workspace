import { CalendarRange, Home } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { termStatusLabel } from "@/features/academic/rules";
import { SCHOOL_TIME_ZONE, formatDate } from "@/lib/time";
import { getAcademicContext } from "@/services/academic";
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

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: SCHOOL_TIME_ZONE,
    }).format(new Date()),
  );
  const firstName = (teacher.fullName || teacher.email).split(/[\s@]/)[0];
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));

  return (
    <>
      <PageHeader
        title={`${greeting(hour)}, ${firstName}!`}
        description={todayLabel}
        icon={Home}
        action={
          selectedYear ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Academic year {selectedYear.name}</Badge>
              <Badge tone={activeTerm ? "brand" : "neutral"}>
                {termStatusLabel(selectedYear, today)}
              </Badge>
            </div>
          ) : undefined
        }
      />
      <Card>
        {selectedYear ? (
          <EmptyState
            icon={<Home className="size-8" aria-hidden />}
            title="Your dashboard is ready for data"
            description={`Viewing ${selectedYear.name} (${formatDate(selectedYear.startDate)} – ${formatDate(selectedYear.endDate)}). Today's schedule, upcoming events, task overview and teaching progress will appear here as you add classes and tasks.`}
          />
        ) : (
          <EmptyState
            icon={<CalendarRange className="size-8" aria-hidden />}
            title="Start by setting up your academic year"
            description="Your workspace is organized by academic year and its three terms. Add the dates for yours and the rest of Teacher Workspace will follow."
            action={
              <LinkButton href="/settings#academic-years">
                <CalendarRange className="size-4" aria-hidden /> Set up academic year
              </LinkButton>
            }
          />
        )}
      </Card>
    </>
  );
}
