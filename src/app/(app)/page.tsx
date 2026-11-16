import { Home } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireTeacher } from "@/services/teacher";

export const metadata: Metadata = { title: "Home" };

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const teacher = await requireTeacher();
  // The dashboard renders in the teacher's local time zone in a later milestone;
  // for M0 the greeting uses Philippine time, the target audience's zone.
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Manila",
    }).format(now),
  );
  const today = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "Asia/Manila",
  }).format(now);
  const firstName = (teacher.fullName || teacher.email).split(/[\s@]/)[0];

  return (
    <>
      <PageHeader title={`${greeting(hour)}, ${firstName}!`} description={today} icon={Home} />
      <Card>
        <EmptyState
          icon={<Home className="size-8" aria-hidden />}
          title="Your dashboard is ready for data"
          description="Today's schedule, upcoming events, task overview and teaching progress will appear here as you set up your academic year, classes and tasks."
        />
      </Card>
    </>
  );
}
