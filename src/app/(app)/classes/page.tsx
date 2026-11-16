import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { ModuleEmptyPage } from "@/components/layout/ModuleEmptyPage";

export const metadata: Metadata = { title: "My Classes" };

export default function ClassesPage() {
  return (
    <ModuleEmptyPage
      title="My Classes"
      description="Manage your subjects, sections, schedules and teaching sessions."
      icon={BookOpen}
      emptyTitle="No classes yet"
      emptyDescription="Your subjects, class sections, weekly schedules and teaching sessions will be managed here."
    />
  );
}
