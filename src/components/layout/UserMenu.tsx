"use client";

import clsx from "clsx";
import { ChevronDown, LifeBuoy, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logOut } from "@/features/auth/actions";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

/** Profile menu: Settings + Log out. Closes on outside click and Escape. */
export function UserMenu({
  name,
  jobTitle,
  placement = "down",
  compact = false,
}: {
  name: string;
  jobTitle?: string;
  placement?: "up" | "down";
  compact?: boolean;
}) {
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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-control hover:bg-brand-100/60 flex w-full items-center gap-3 px-2 py-2 text-left"
      >
        <span className="bg-brand-500 grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white">
          {initials(name)}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="text-ink block truncate text-sm font-bold">{name || "Teacher"}</span>
            {jobTitle && <span className="text-ink-faint block truncate text-xs">{jobTitle}</span>}
          </span>
        )}
        {!compact && <ChevronDown className="text-ink-faint size-4 shrink-0" aria-hidden />}
        {compact && <span className="sr-only">Account menu</span>}
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            "rounded-card border-line bg-surface shadow-pop absolute z-50 w-56 border p-1.5",
            placement === "up" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2",
          )}
        >
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="rounded-control text-ink hover:bg-brand-100/60 flex h-10 items-center gap-2.5 px-3 text-sm font-semibold"
          >
            <Settings className="size-4" aria-hidden /> Profile &amp; settings
          </Link>
          <Link
            role="menuitem"
            href="/help"
            onClick={() => setOpen(false)}
            className="rounded-control text-ink hover:bg-brand-100/60 flex h-10 items-center gap-2.5 px-3 text-sm font-semibold"
          >
            <LifeBuoy className="size-4" aria-hidden /> Help &amp; Support
          </Link>
          <form action={logOut}>
            <button
              role="menuitem"
              type="submit"
              className="rounded-control text-danger-500 hover:bg-danger-50 flex h-10 w-full items-center gap-2.5 px-3 text-sm font-semibold"
            >
              <LogOut className="size-4" aria-hidden /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
