import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "./PageHeader";

/**
 * Placeholder for modules that are built in later milestones.
 * Shows a truthful empty state: no sample data and no buttons that do nothing.
 */
export function ModuleEmptyPage({
  title,
  description,
  icon: Icon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} icon={Icon} />
      <Card>
        <EmptyState
          icon={<Icon className="size-8" aria-hidden />}
          title={emptyTitle}
          description={emptyDescription}
        />
      </Card>
    </>
  );
}
