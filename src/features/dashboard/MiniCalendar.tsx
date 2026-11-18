import clsx from "clsx";
import Link from "next/link";
import { COLOR_CLASSES, type ColorKey } from "@/features/calendar/constants";
import { itemsOnDate } from "@/features/calendar/items";
import type { CalendarItem } from "@/features/calendar/types";
import {
  addDays,
  dayOfMonth,
  endOfMonth,
  formatMonth,
  startOfMonth,
  startOfWeek,
} from "@/lib/time";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The current month at a glance. Each day links to that day in the calendar; dots show what is on it. */
export function MiniCalendar({ today, items }: { today: string; items: CalendarItem[] }) {
  const first = startOfMonth(today);
  const last = endOfMonth(today);
  const days: string[] = [];
  for (
    let d = startOfWeek(first);
    d <= startOfWeek(last) || days.length % 7 !== 0;
    d = addDays(d, 1)
  ) {
    days.push(d);
    if (days.length > 42) break;
  }
  return (
    <div>
      <p className="text-ink mb-2 text-center text-sm font-bold">{formatMonth(first)}</p>
      <div className="text-ink-faint grid grid-cols-7 text-center text-[11px] font-bold">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const inMonth = d >= first && d <= last;
          const on = inMonth ? itemsOnDate(items, d).filter((i) => i.kind !== "noclass") : [];
          const colors = [...new Set(on.map((i) => i.color))].slice(0, 3);
          return (
            <Link
              key={d}
              href={`/calendar?view=day&date=${d}`}
              aria-label={`${d}${on.length ? `, ${on.length} ${on.length === 1 ? "item" : "items"}` : ""}`}
              aria-current={d === today ? "date" : undefined}
              className={clsx(
                "hover:bg-brand-50 mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm",
                !inMonth && "text-ink-faint/50",
                d === today
                  ? "bg-brand-500 hover:bg-brand-600 font-bold text-white"
                  : inMonth && "text-ink",
              )}
            >
              {dayOfMonth(d)}
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {colors.map((c) => (
                  <span
                    key={c}
                    className={clsx(
                      "size-1 rounded-full",
                      d === today
                        ? "bg-white"
                        : (COLOR_CLASSES[c as ColorKey]?.dot ?? "bg-ink-faint"),
                    )}
                  />
                ))}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
