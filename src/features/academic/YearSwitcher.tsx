"use client";

import { useTransition } from "react";
import { selectAcademicYear } from "./actions";

/** Dropdown that changes which academic year the whole workspace shows. */
export function YearSwitcher({
  years,
  selectedId,
}: {
  years: { id: string; name: string }[];
  selectedId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="text-ink-soft flex items-center gap-2 text-sm font-semibold">
      <span className="hidden sm:inline">Academic year</span>
      <select
        aria-label="Academic year"
        value={selectedId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(() => selectAcademicYear(id));
        }}
        className="rounded-control border-line bg-surface text-ink shadow-card focus:border-brand-400 focus:ring-brand-200 h-10 border px-3 text-sm font-semibold focus:ring-2 focus:outline-none disabled:opacity-60"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
          </option>
        ))}
      </select>
    </label>
  );
}
