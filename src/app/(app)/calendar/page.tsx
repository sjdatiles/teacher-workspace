import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { ModuleEmptyPage } from "@/components/layout/ModuleEmptyPage";

export const metadata: Metadata = { title: "Calendar & Planner" };

export default function CalendarPage() {
  return (
    <ModuleEmptyPage
      title="Calendar & Planner"
      description="Plan your teaching schedule, meetings and deadlines in one place."
      icon={CalendarDays}
      emptyTitle="Nothing scheduled yet"
      emptyDescription="Month, week and day views of your teaching sessions and events will appear here."
    />
  );
}
