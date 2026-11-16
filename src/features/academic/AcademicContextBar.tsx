import { CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { getAcademicContext } from "@/services/academic";
import { termStatusLabel } from "./rules";
import { YearSwitcher } from "./YearSwitcher";

/**
 * Sits above every page: which academic year is being viewed and where today falls in it.
 * Modules read the same selection through getAcademicContext(), so they stay consistent.
 */
export async function AcademicContextBar() {
  const { years, selectedYear, currentYear, today, activeTerm } = await getAcademicContext();

  if (!selectedYear) {
    return (
      <div className="mb-4 flex justify-end">
        <LinkButton href="/settings#academic-years" variant="secondary" className="h-10">
          <CalendarRange className="size-4" aria-hidden /> Set up academic year
        </LinkButton>
      </div>
    );
  }

  const status = termStatusLabel(selectedYear, today);
  const isCurrent = currentYear?.id === selectedYear.id;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
      {!isCurrent && <Badge tone="warning">Not the current year</Badge>}
      <Badge tone={activeTerm ? "brand" : "neutral"}>{status}</Badge>
      <YearSwitcher
        years={years.map((y) => ({ id: y.id, name: y.name }))}
        selectedId={selectedYear.id}
      />
    </div>
  );
}
