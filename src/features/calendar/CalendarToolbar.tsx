import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { formatLongDate, formatMonth, formatRange } from "@/lib/time";
import { DISPLAY_CATEGORIES, VIEWS, type CalendarView } from "./constants";
import { calHref, shiftDate, visibleRange } from "./nav";

export function viewTitle(view: CalendarView, date: string): string {
  if (view === "month") return formatMonth(date);
  if (view === "day") return formatLongDate(date);
  const { from, to } = visibleRange("week", date);
  return formatRange(from, to);
}

/** Date navigation, view switch, search and category filter. All state lives in the URL. */
export function CalendarToolbar({
  view,
  date,
  today,
  q,
  cat,
  termLabels,
}: {
  view: CalendarView;
  date: string;
  today: string;
  q: string;
  cat: string;
  termLabels: string[];
}) {
  const nav =
    "rounded-control border-line hover:bg-brand-50 inline-flex h-10 items-center justify-center border bg-surface px-3 text-sm font-semibold";
  return (
    <Card className="mb-4 space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={calHref({ view, date: shiftDate(view, date, -1), q, cat })}
            className={nav}
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href={calHref({ view, date: shiftDate(view, date, 1), q, cat })}
            className={nav}
            aria-label="Next"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          <Link href={calHref({ view, date: today, q, cat })} className={nav}>
            Today
          </Link>
          <h2 className="text-ink ml-1 text-lg font-extrabold sm:text-xl" aria-live="polite">
            {viewTitle(view, date)}
          </h2>
        </div>
        <div
          role="group"
          aria-label="Calendar view"
          className="bg-brand-50 rounded-control flex p-1"
        >
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={calHref({ view: v.value, date, q, cat })}
              aria-current={v.value === view ? "page" : undefined}
              className={clsx(
                "rounded-lg px-3.5 py-1.5 text-sm font-semibold",
                v.value === view
                  ? "text-brand-700 bg-white shadow-sm"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </div>

      {termLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {termLabels.map((t) => (
            <Badge key={t} tone="brand">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <form method="get" action="/calendar" className="grid gap-3 sm:grid-cols-[1fr_14rem_auto]">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="date" value={date} />
        <div className="space-y-1.5">
          <label htmlFor="cal-q" className="text-ink block text-sm font-semibold">
            Search events
          </label>
          <div className="relative">
            <Search
              className="text-ink-faint pointer-events-none absolute top-3 left-3 size-4"
              aria-hidden
            />
            <input
              id="cal-q"
              name="q"
              defaultValue={q}
              placeholder="Title, place or notes"
              className="rounded-control bg-surface border-line text-ink placeholder:text-ink-faint focus:border-brand-400 focus:ring-brand-200 h-11 w-full border pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
        </div>
        <SelectField
          label="Show"
          name="cat"
          defaultValue={cat}
          placeholder="All categories"
          options={DISPLAY_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {(q || cat) && (
            <Link
              href={calHref({ view, date })}
              className="text-brand-700 flex h-11 items-center px-2 text-sm font-semibold"
            >
              Reset
            </Link>
          )}
        </div>
      </form>
    </Card>
  );
}
