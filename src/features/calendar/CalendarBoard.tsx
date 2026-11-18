"use client";

import { useClearNewParam } from "@/lib/use-auto-open";
import clsx from "clsx";
import {
  CalendarDays,
  CalendarOff,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { NoticeBar } from "@/components/ui/Notice";
import { addDays, dayOfMonth, formatDate, formatLongDate, weekdayShort } from "@/lib/time";
import { useRunAction } from "@/lib/use-action";
import { deleteEvent, resetOccurrence, skipOccurrence } from "./actions";
import {
  COLOR_CLASSES,
  categoryLabel,
  reminderLabel,
  type CalendarView,
  type ColorKey,
} from "./constants";
import { EventForm, type FormMode } from "./EventForm";
import { itemTimeLabel, itemsOnDate } from "./items";
import { calHref } from "./nav";
import { describeRepeat } from "./recurrence";
import type { CalendarItem } from "./types";

const colorOf = (key: string) => COLOR_CLASSES[(key in COLOR_CLASSES ? key : "orange") as ColorKey];

type Dialog =
  | { kind: "details"; item: CalendarItem }
  | { kind: "form"; mode: FormMode }
  | { kind: "skip" | "delete" | "reset"; item: CalendarItem }
  | null;

export function CalendarBoard({
  view,
  date,
  today,
  items,
  rangeFrom,
  q,
  cat,
  searchResults,
  autoOpen = false,
}: {
  view: CalendarView;
  date: string;
  today: string;
  items: CalendarItem[];
  rangeFrom: string;
  q: string;
  cat: string;
  /** When set, the page shows search results instead of a grid. */
  searchResults: CalendarItem[] | null;
  /** Open the add-event form straight away (Home quick action). */
  autoOpen?: boolean;
}) {
  const [dialog, setDialog] = useState<Dialog>(
    autoOpen ? { kind: "form", mode: { kind: "new", date: today } } : null,
  );
  useClearNewParam(autoOpen);
  const { run, pending, notice, clear, show } = useRunAction();
  const close = () => setDialog(null);
  const open = (item: CalendarItem) => setDialog({ kind: "details", item });
  const addOn = (d: string) => setDialog({ kind: "form", mode: { kind: "new", date: d } });

  const month = date.slice(0, 7);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft text-sm">
          {searchResults
            ? `Search results for “${q}”`
            : "Your events and teaching sessions. Teaching sessions come from My Classes."}
        </p>
        <Button size="sm" onClick={() => addOn(view === "month" ? today : date)}>
          <Plus className="size-4" aria-hidden /> Add event
        </Button>
      </div>
      <NoticeBar notice={notice} onClose={clear} />

      {searchResults ? (
        <SearchList results={searchResults} onOpen={open} />
      ) : view === "month" ? (
        <MonthGrid
          date={date}
          month={month}
          today={today}
          items={items}
          rangeFrom={rangeFrom}
          q={q}
          cat={cat}
          onOpen={open}
        />
      ) : view === "week" ? (
        <WeekGrid
          rangeFrom={rangeFrom}
          today={today}
          items={items}
          q={q}
          cat={cat}
          onOpen={open}
          onAdd={addOn}
        />
      ) : (
        <DayList date={date} items={items} onOpen={open} onAdd={addOn} />
      )}

      {dialog?.kind === "details" && (
        <Modal
          open
          onClose={close}
          title={
            dialog.item.kind === "event"
              ? "Event"
              : dialog.item.kind === "session"
                ? "Teaching session"
                : "No class"
          }
        >
          <Details
            item={dialog.item}
            onEditOccurrence={(item) =>
              setDialog({
                kind: "form",
                mode: { kind: "occurrence", event: item.event!, occurrence: item.occurrence! },
              })
            }
            onEditAll={(item) =>
              setDialog({ kind: "form", mode: { kind: "event", event: item.event! } })
            }
            onAction={(kind, item) => setDialog({ kind, item })}
          />
        </Modal>
      )}

      {dialog?.kind === "form" && (
        <Modal
          open
          onClose={close}
          title={
            dialog.mode.kind === "new"
              ? "Add event"
              : dialog.mode.kind === "occurrence"
                ? "Edit this occurrence"
                : "Edit event"
          }
        >
          <EventForm
            mode={dialog.mode}
            onDone={(m) => {
              close();
              show(m);
            }}
            onCancel={close}
          />
        </Modal>
      )}

      {dialog?.kind === "skip" && (
        <ConfirmModal
          title="Remove this occurrence?"
          confirmLabel="Remove occurrence"
          pending={pending}
          onClose={close}
          onConfirm={() =>
            run(
              () =>
                skipOccurrence(
                  dialog.item.occurrence!.eventId,
                  dialog.item.occurrence!.occurrenceDate,
                ),
              close,
            )
          }
        >
          <p>
            Only {formatDate(dialog.item.occurrence!.occurrenceDate)} is removed. Every other date
            of this repeating event stays.
          </p>
        </ConfirmModal>
      )}
      {dialog?.kind === "reset" && (
        <ConfirmModal
          title="Reset this occurrence?"
          confirmLabel="Reset to the series"
          pending={pending}
          onClose={close}
          onConfirm={() =>
            run(
              () =>
                resetOccurrence(
                  dialog.item.occurrence!.eventId,
                  dialog.item.occurrence!.occurrenceDate,
                ),
              close,
            )
          }
        >
          <p>
            Your changes to this one occurrence are discarded and it follows the repeating event
            again.
          </p>
        </ConfirmModal>
      )}
      {dialog?.kind === "delete" && (
        <ConfirmModal
          title={
            dialog.item.event!.repeatFreq !== "none"
              ? "Delete the whole series?"
              : "Delete this event?"
          }
          confirmLabel={dialog.item.event!.repeatFreq !== "none" ? "Delete series" : "Delete event"}
          pending={pending}
          onClose={close}
          onConfirm={() => run(() => deleteEvent(dialog.item.event!.id), close)}
        >
          <p>
            {dialog.item.event!.repeatFreq !== "none"
              ? "Every occurrence of this repeating event is deleted. To remove just one date, use “Remove this occurrence” instead."
              : "This cannot be undone."}
          </p>
        </ConfirmModal>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
function ItemButton({
  item,
  onOpen,
  compact,
}: {
  item: CalendarItem;
  onOpen: (i: CalendarItem) => void;
  compact?: boolean;
}) {
  if (item.kind === "noclass") {
    return (
      <span className="bg-line/70 text-ink-soft flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-xs font-semibold">
        <CalendarOff className="size-3 shrink-0" aria-hidden />
        {item.title}
      </span>
    );
  }
  const dim = item.status === "cancelled" || item.status === "rescheduled";
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={clsx(
        "flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs font-semibold",
        colorOf(item.color).chip,
        dim && "line-through opacity-60",
        item.category === "teaching_session" && "ring-brand-400 ring-1",
      )}
      title={`${itemTimeLabel(item)} · ${item.title}`}
    >
      {!compact && item.startTime && <span className="shrink-0 font-bold">{item.startTime}</span>}
      <span className="truncate">{item.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------
function MonthGrid({
  date,
  month,
  today,
  items,
  rangeFrom,
  q,
  cat,
  onOpen,
}: {
  date: string;
  month: string;
  today: string;
  items: CalendarItem[];
  rangeFrom: string;
  q: string;
  cat: string;
  onOpen: (i: CalendarItem) => void;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(rangeFrom, i));
  void date;
  return (
    <div>
      <div
        className="text-ink-soft mb-1 grid grid-cols-7 text-center text-xs font-bold"
        aria-hidden
      >
        {days.slice(0, 7).map((d) => (
          <div key={d} className="py-1.5">
            {weekdayShort(d)}
          </div>
        ))}
      </div>
      <div
        className="border-line grid grid-cols-7 overflow-hidden rounded-xl border"
        role="grid"
        aria-label="Month"
      >
        {days.map((d) => {
          const list = itemsOnDate(items, d);
          const shown = list.slice(0, 3);
          const inMonth = d.startsWith(month);
          return (
            <div
              key={d}
              role="gridcell"
              className={clsx(
                "border-line min-h-16 border-r border-b p-1 last:border-r-0 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-canvas/70",
              )}
            >
              <Link
                href={calHref({ view: "day", date: d, q, cat })}
                aria-label={`${formatLongDate(d)}${list.length ? `, ${list.length} item${list.length === 1 ? "" : "s"}` : ""}`}
                className={clsx(
                  "inline-grid size-7 place-items-center rounded-full text-xs font-bold",
                  d === today
                    ? "bg-brand-500 text-white"
                    : inMonth
                      ? "text-ink hover:bg-brand-100"
                      : "text-ink-faint hover:bg-brand-100",
                )}
              >
                {dayOfMonth(d)}
              </Link>
              {/* Phones: colored dots. Larger screens: readable chips. */}
              <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                {list.slice(0, 4).map((i) => (
                  <span
                    key={i.key}
                    className={clsx(
                      "size-1.5 rounded-full",
                      i.kind === "noclass" ? "bg-ink-faint" : colorOf(i.color).dot,
                    )}
                  />
                ))}
              </div>
              <div className="mt-1 hidden space-y-0.5 sm:block">
                {shown.map((i) => (
                  <ItemButton key={i.key} item={i} onOpen={onOpen} />
                ))}
                {list.length > shown.length && (
                  <Link
                    href={calHref({ view: "day", date: d, q, cat })}
                    className="text-brand-700 block px-1 text-xs font-semibold hover:underline"
                  >
                    +{list.length - shown.length} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------
function WeekGrid({
  rangeFrom,
  today,
  items,
  q,
  cat,
  onOpen,
  onAdd,
}: {
  rangeFrom: string;
  today: string;
  items: CalendarItem[];
  q: string;
  cat: string;
  onOpen: (i: CalendarItem) => void;
  onAdd: (d: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(rangeFrom, i));
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {days.map((d) => {
        const list = itemsOnDate(items, d);
        return (
          <section
            key={d}
            aria-label={formatLongDate(d)}
            className={clsx(
              "rounded-control border p-2.5",
              d === today ? "border-brand-300 bg-brand-50" : "border-line",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <Link
                href={calHref({ view: "day", date: d, q, cat })}
                className="text-ink hover:text-brand-700 text-sm font-bold"
              >
                {weekdayShort(d)} {dayOfMonth(d)}
              </Link>
              <button
                type="button"
                onClick={() => onAdd(d)}
                aria-label={`Add event on ${formatDate(d)}`}
                className="text-ink-soft hover:bg-brand-100 grid size-7 place-items-center rounded-md"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
            {list.length === 0 ? (
              <p className="text-ink-faint text-xs">Nothing scheduled</p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((i) => (
                  <li key={i.key}>
                    <ItemButton item={i} onOpen={onOpen} />
                    {i.kind !== "noclass" && (
                      <p className="text-ink-faint truncate px-1.5 text-[11px]">
                        {itemTimeLabel(i)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day
// ---------------------------------------------------------------------------
function DayList({
  date,
  items,
  onOpen,
  onAdd,
}: {
  date: string;
  items: CalendarItem[];
  onOpen: (i: CalendarItem) => void;
  onAdd: (d: string) => void;
}) {
  const list = itemsOnDate(items, date);
  if (list.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="size-8" aria-hidden />}
        title="Nothing scheduled"
        description={`No classes or events on ${formatLongDate(date)}.`}
        action={
          <Button onClick={() => onAdd(date)}>
            <Plus className="size-4" aria-hidden /> Add event
          </Button>
        }
      />
    );
  }
  return (
    <ul className="divide-line divide-y">
      {list.map((i) => (
        <li key={i.key} className="flex gap-4 py-3">
          <div className="text-ink-soft w-32 shrink-0 pt-1 text-sm font-semibold">
            {i.kind === "noclass" ? "All day" : itemTimeLabel(i)}
          </div>
          <div className="min-w-0 flex-1">
            {i.kind === "noclass" ? (
              <p className="text-ink-soft flex items-center gap-2 text-sm font-semibold">
                <CalendarOff className="size-4" aria-hidden /> No class
                {i.title !== "No class" ? ` — ${i.title}` : ""}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(i)}
                className={clsx(
                  "rounded-control block w-full px-3 py-2 text-left",
                  colorOf(i.color).chip,
                  (i.status === "cancelled" || i.status === "rescheduled") && "opacity-60",
                )}
              >
                <span
                  className={clsx(
                    "block text-sm font-bold",
                    (i.status === "cancelled" || i.status === "rescheduled") && "line-through",
                  )}
                >
                  {i.title}
                </span>
                <span className="block text-xs">{i.subtitle}</span>
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Search results
// ---------------------------------------------------------------------------
function SearchList({
  results,
  onOpen,
}: {
  results: CalendarItem[];
  onOpen: (i: CalendarItem) => void;
}) {
  if (results.length === 0)
    return (
      <EmptyState
        icon={<CalendarDays className="size-8" aria-hidden />}
        title="No events found"
        description="Try a different word, or clear the category filter. Search covers events you created; teaching sessions are found in My Classes."
      />
    );
  return (
    <ul className="divide-line divide-y">
      {results.map((i) => (
        <li key={i.key} className="py-3">
          <button
            type="button"
            onClick={() => onOpen(i)}
            className="hover:bg-brand-50 rounded-control flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-left"
          >
            <span className={clsx("size-2.5 rounded-full", colorOf(i.color).dot)} aria-hidden />
            <span className="text-ink font-bold">{i.title}</span>
            <span className="text-ink-soft text-sm">{formatDate(i.startDate)}</span>
            <Badge tone="neutral">{categoryLabel(i.category)}</Badge>
            {i.event && i.event.repeatFreq !== "none" && (
              <Badge tone="info">{describeRepeat(i.event)}</Badge>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-faint text-xs font-semibold">{label}</dt>
      <dd className="text-ink mt-0.5 text-sm whitespace-pre-line">{children}</dd>
    </div>
  );
}

function Details({
  item,
  onEditOccurrence,
  onEditAll,
  onAction,
}: {
  item: CalendarItem;
  onEditOccurrence: (i: CalendarItem) => void;
  onEditAll: (i: CalendarItem) => void;
  onAction: (kind: "skip" | "delete" | "reset", i: CalendarItem) => void;
}) {
  const when =
    item.startDate === item.endDate
      ? formatLongDate(item.startDate)
      : `${formatLongDate(item.startDate)} → ${formatLongDate(item.endDate)}`;

  if (item.kind === "session") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ink text-lg font-bold">{item.title}</h3>
          <Badge tone="brand">{categoryLabel(item.category)}</Badge>
        </div>
        <dl className="space-y-3">
          <Row label="When">
            {when}
            {"\n"}
            {itemTimeLabel(item)}
          </Row>
          <Row label="Class">{item.subtitle}</Row>
        </dl>
        <p className="text-ink-faint text-xs">
          Sessions are managed in My Classes, so a class is never recorded twice.
        </p>
        <Link
          href={`/classes?tab=sessions&when=all`}
          className="rounded-control bg-brand-500 shadow-card hover:bg-brand-600 inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white"
        >
          <ExternalLink className="size-4" aria-hidden /> Open in My Classes
        </Link>
      </div>
    );
  }

  const ev = item.event!;
  const occ = item.occurrence;
  const repeating = ev.repeatFreq !== "none";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-ink text-lg font-bold">{occ?.title ?? ev.title}</h3>
        <Badge tone="neutral">{categoryLabel(ev.category)}</Badge>
        {occ?.changed && <Badge tone="warning">Changed occurrence</Badge>}
      </div>
      <dl className="space-y-3">
        <Row label="When">
          {when}
          {"\n"}
          {item.startTime && item.endTime ? itemTimeLabel(item) : "All day"}
        </Row>
        {(occ?.location ?? ev.location) && (
          <Row label="Location">{occ?.location ?? ev.location}</Row>
        )}
        {(occ?.description ?? ev.description) && (
          <Row label="Description">{occ?.description ?? ev.description}</Row>
        )}
        {(occ?.notes ?? ev.notes) && <Row label="Notes">{occ?.notes ?? ev.notes}</Row>}
        <Row label="Reminder">{reminderLabel(ev.reminderMinutes)}</Row>
        <Row label="Repeats">
          {describeRepeat(ev)}
          {repeating && ev.repeatUntil ? ` until ${formatDate(ev.repeatUntil)}` : ""}
        </Row>
      </dl>

      <div className="border-line flex flex-wrap gap-2 border-t pt-4">
        {repeating && occ ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => onEditOccurrence(item)}>
              <Pencil className="size-4" aria-hidden /> Edit this occurrence
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onEditAll(item)}>
              <Pencil className="size-4" aria-hidden /> Edit all
            </Button>
            {occ.changed && (
              <Button size="sm" variant="ghost" onClick={() => onAction("reset", item)}>
                <RotateCcw className="size-4" aria-hidden /> Reset to series
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onAction("skip", item)}>
              <Trash2 className="size-4" aria-hidden /> Remove this occurrence
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction("delete", item)}>
              <Trash2 className="size-4" aria-hidden /> Delete series
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={() => onEditAll(item)}>
              <Pencil className="size-4" aria-hidden /> Edit{repeating ? " series" : ""}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction("delete", item)}>
              <Trash2 className="size-4" aria-hidden /> Delete{repeating ? " series" : ""}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
