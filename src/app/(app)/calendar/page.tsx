import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { CalendarBoard } from "@/features/calendar/CalendarBoard";
import { CalendarToolbar } from "@/features/calendar/CalendarToolbar";
import { DISPLAY_CATEGORIES, VIEWS, type CalendarView } from "@/features/calendar/constants";
import { occurrenceToItem } from "@/features/calendar/items";
import { visibleRange } from "@/features/calendar/nav";
import { isValidISODate } from "@/lib/time";
import { getAcademicContext } from "@/services/academic";
import { getCalendarItems, searchEvents } from "@/services/calendar";

export const metadata: Metadata = { title: "Calendar & Planner" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { today, years } = await getAcademicContext();

  const view = (
    VIEWS.some((v) => v.value === one(sp.view)) ? one(sp.view) : "month"
  ) as CalendarView;
  const date = isValidISODate(one(sp.date)) ? one(sp.date) : today;
  const q = one(sp.q).trim().slice(0, 100);
  const cat = DISPLAY_CATEGORIES.some((c) => c.value === one(sp.cat)) ? one(sp.cat) : "";

  const { from, to } = visibleRange(view, date);

  // Which terms (of any academic year) the visible dates fall in.
  const termLabels = years.flatMap((y) =>
    y.terms
      .filter((t) => t.startDate <= to && t.endDate >= from)
      .map((t) => `Term ${t.termNumber} · ${y.name}`),
  );

  let items = [] as Awaited<ReturnType<typeof getCalendarItems>>;
  let searchResults: typeof items | null = null;

  if (q) {
    const found = await searchEvents(
      q,
      cat && cat !== "teaching_schedule" && cat !== "teaching_session" ? cat : null,
    );
    searchResults = found.map((e) =>
      occurrenceToItem(
        {
          eventId: e.id,
          occurrenceDate: e.startDate,
          title: e.title,
          description: e.description,
          location: e.location,
          notes: e.notes,
          startDate: e.startDate,
          endDate: e.endDate,
          startTime: e.startTime,
          endTime: e.endTime,
          changed: false,
        },
        e,
      ),
    );
    // From search the whole event is opened, not one date of a series.
    searchResults = searchResults.map((i) => ({ ...i, occurrence: undefined }));
  } else {
    items = await getCalendarItems(from, to);
    if (cat) items = items.filter((i) => i.category === cat);
  }

  return (
    <>
      <PageHeader
        title="Calendar & Planner"
        description="Your teaching schedule, meetings, school activities and deadlines in one place."
        icon={CalendarDays}
      />
      <CalendarToolbar
        view={view}
        date={date}
        today={today}
        q={q}
        cat={cat}
        termLabels={termLabels}
      />
      <CalendarBoard
        key={`${view}-${date}-${q}-${cat}`}
        view={view}
        date={date}
        today={today}
        items={items}
        rangeFrom={from}
        q={q}
        cat={cat}
        searchResults={searchResults}
        autoOpen={one(sp.new) === "1"}
      />
    </>
  );
}
