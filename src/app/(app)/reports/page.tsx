import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { ModuleEmptyPage } from "@/components/layout/ModuleEmptyPage";

export const metadata: Metadata = { title: "Reports & Accomplishments" };

export default function ReportsPage() {
  return (
    <ModuleEmptyPage
      title="Reports & Accomplishments"
      description="Track your teaching progress across Term 1, Term 2 and Term 3."
      icon={BarChart3}
      emptyTitle="No completed sessions yet"
      emptyDescription="Reports count only teaching sessions marked Completed. Totals, charts and per-section tables will appear once you complete sessions."
    />
  );
}
