import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Help & Support" };

const topics = [
  {
    q: "How do terms work?",
    a: "Each academic year has exactly three terms: Term 1, Term 2 and Term 3. You set the dates for your own school.",
  },
  {
    q: "What counts in my reports?",
    a: "Only teaching sessions marked Completed count toward session totals and teaching hours. Scheduled, Cancelled and Rescheduled sessions never do.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Every record belongs to your account and is protected in the database, so other teachers can never see it.",
  },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader
        title="Help & Support"
        description="Quick answers about how Teacher Workspace works."
        icon={LifeBuoy}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {topics.map((t) => (
          <Card key={t.q}>
            <h2 className="text-base font-bold">{t.q}</h2>
            <p className="text-ink-soft mt-2 text-sm">{t.a}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
