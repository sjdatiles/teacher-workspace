"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Notification center shell. Notifications are produced in M7; until then the
 * panel truthfully reports that there is nothing to show (no fake items, no badge).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="border-line bg-surface text-ink-soft shadow-card hover:text-ink grid size-11 place-items-center rounded-full border"
      >
        <Bell className="size-5" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="rounded-card border-line bg-surface shadow-pop absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] border p-5"
        >
          <h2 className="text-base font-bold">Notifications</h2>
          <p className="text-ink-soft mt-3 text-sm">
            You&apos;re all caught up. Reminders for upcoming sessions, events and task deadlines
            will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
