import { CheckSquare } from "lucide-react";
import type { Metadata } from "next";
import { ModuleEmptyPage } from "@/components/layout/ModuleEmptyPage";

export const metadata: Metadata = { title: "Tasks & Responsibilities" };

export default function TasksPage() {
  return (
    <ModuleEmptyPage
      title="Tasks & Responsibilities"
      description="Stay organized and get things done, one task at a time."
      icon={CheckSquare}
      emptyTitle="No tasks yet"
      emptyDescription="Your teaching, administrative and personal tasks will be listed here, with list and board views."
    />
  );
}
