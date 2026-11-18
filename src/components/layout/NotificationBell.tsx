"use client";

import clsx from "clsx";
import { AlarmClock, Bell, CalendarClock, CheckCheck, GraduationCap, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { setNotificationState } from "@/features/notifications/actions";
import type { NotificationKind } from "@/features/notifications/rules";

export type BellItem = {
  key: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string;
  read: boolean;
};

const ICON: Record<NotificationKind, typeof Bell> = {
  session: GraduationCap,
  event: CalendarClock,
  deadline: AlarmClock,
  overdue: AlarmClock,
};
const TONE: Record<NotificationKind, string> = {
  session: "bg-brand-100 text-brand-700",
  event: "bg-info-50 text-info-500",
  deadline: "bg-warning-50 text-warning-500",
  overdue: "bg-danger-50 text-danger-500",
};

/** Notification center: reminders for sessions, events and task deadlines, worked out from the teacher's own records. */
export function NotificationBell({ items }: { items: BellItem[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => !i.read);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const mark = (keys: string[], state: "read" | "dismissed") =>
    startTransition(() => void setNotificationState(keys, state));

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} unread` : "Notifications"}
        onClick={() => setOpen((v) => !v)}
        className="border-line bg-surface text-ink-soft shadow-card hover:text-ink relative grid size-11 place-items-center rounded-full border"
      >
        <Bell className="size-5" aria-hidden />
        {unread.length > 0 && (
          <span className="bg-danger-500 absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full px-1 text-[11px] leading-5 font-bold text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="rounded-card border-line bg-surface shadow-pop fixed inset-x-4 top-[4.5rem] z-50 border sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96"
        >
          <div className="border-line flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-base font-bold">Notifications</h2>
            {unread.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  mark(
                    unread.map((i) => i.key),
                    "read",
                  )
                }
                className="text-brand-700 hover:bg-brand-50 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold"
              >
                <CheckCheck className="size-4" aria-hidden /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-ink-soft px-4 py-5 text-sm">
              You&apos;re all caught up. Reminders for upcoming sessions, events and task deadlines
              appear here.
            </p>
          ) : (
            <ul className="divide-line max-h-96 divide-y overflow-y-auto">
              {items.map((n) => {
                const Icon = ICON[n.kind];
                return (
                  <li
                    key={n.key}
                    className={clsx(
                      "flex items-start gap-3 px-4 py-3",
                      !n.read && "bg-brand-50/60",
                    )}
                  >
                    <span
                      className={clsx(
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                        TONE[n.kind],
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <Link
                      href={n.href}
                      onClick={() => {
                        setOpen(false);
                        if (!n.read) mark([n.key], "read");
                      }}
                      className="min-w-0 flex-1"
                    >
                      <p
                        className={clsx(
                          "text-ink truncate text-sm",
                          n.read ? "font-semibold" : "font-bold",
                        )}
                      >
                        {n.title}
                      </p>
                      <p className="text-ink-soft text-xs">{n.message}</p>
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => mark([n.key], "dismissed")}
                      aria-label={`Dismiss ${n.title}`}
                      title="Dismiss"
                      className="text-ink-faint hover:bg-brand-100 hover:text-brand-700 grid size-8 shrink-0 place-items-center rounded-lg"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
