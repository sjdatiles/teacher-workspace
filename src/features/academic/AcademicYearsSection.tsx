"use client";

import { CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import type { FormState } from "@/lib/form-state";
import { formatRange } from "@/lib/time";
import { deleteAcademicYear, selectAcademicYear } from "./actions";
import { activeTermFor, termStatusLabel, type AcademicYear } from "./rules";
import { YearForm } from "./YearForm";

type Editing = { mode: "create" } | { mode: "edit"; year: AcademicYear } | null;

export function AcademicYearsSection({
  years,
  selectedId,
  currentId,
  today,
}: {
  years: AcademicYear[];
  selectedId: string | null;
  currentId: string | null;
  today: string;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AcademicYear | null>(null);
  const [switching, startSwitch] = useTransition();
  const closeEditor = useCallback(() => setEditing(null), []);

  return (
    <Card id="academic-years" className="scroll-mt-24">
      <CardHeader
        title="Academic years"
        icon={<CalendarRange className="size-4.5" aria-hidden />}
        action={
          <Button size="sm" onClick={() => setEditing({ mode: "create" })}>
            <Plus className="size-4" aria-hidden /> Add academic year
          </Button>
        }
      />
      <p className="text-ink-soft mb-4 text-sm">
        Each academic year has exactly three terms: Term 1, Term 2 and Term 3. You set the dates to
        match your school&apos;s calendar.
      </p>

      {years.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-8" aria-hidden />}
          title="No academic year yet"
          description="Create your first academic year and set the dates of its three terms. Classes, sessions and reports are organized by it."
          action={
            <Button onClick={() => setEditing({ mode: "create" })}>
              <Plus className="size-4" aria-hidden /> Add academic year
            </Button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {years.map((year) => {
            const active = activeTermFor(year.terms, today);
            const isSelected = year.id === selectedId;
            return (
              <li key={year.id} className="rounded-card border-line border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-ink text-base font-bold">{year.name}</h3>
                      {year.id === currentId && <Badge tone="success">Current year</Badge>}
                      {isSelected && <Badge tone="brand">Viewing</Badge>}
                    </div>
                    <p className="text-ink-soft text-sm">
                      {formatRange(year.startDate, year.endDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isSelected && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={switching}
                        onClick={() => startSwitch(() => selectAcademicYear(year.id))}
                      >
                        View this year
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing({ mode: "edit", year })}
                      aria-label={`Edit ${year.name}`}
                    >
                      <Pencil className="size-4" aria-hidden /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleting(year)}
                      aria-label={`Delete ${year.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden /> Delete
                    </Button>
                  </div>
                </div>

                <ol className="mt-4 grid gap-2 sm:grid-cols-3">
                  {year.terms.map((t) => (
                    <li
                      key={t.id}
                      className={`rounded-control border p-3 ${
                        active?.id === t.id ? "border-brand-300 bg-brand-50" : "border-line"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">Term {t.termNumber}</span>
                        {active?.id === t.id && <Badge tone="brand">Active now</Badge>}
                      </div>
                      <p className="text-ink-soft mt-0.5 text-xs">
                        {formatRange(t.startDate, t.endDate)}
                      </p>
                    </li>
                  ))}
                </ol>
                <p className="text-ink-faint mt-3 text-xs">Today: {termStatusLabel(year, today)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <Modal
          open
          onClose={closeEditor}
          title={editing.mode === "edit" ? `Edit ${editing.year.name}` : "Add academic year"}
        >
          <YearForm
            year={editing.mode === "edit" ? editing.year : undefined}
            onDone={closeEditor}
          />
        </Modal>
      )}

      {deleting && <DeleteYearModal year={deleting} onClose={() => setDeleting(null)} />}
    </Card>
  );
}

const initial: FormState = {};

function DeleteYearModal({ year, onClose }: { year: AcademicYear; onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteAcademicYear, initial);
  useEffect(() => {
    if (state.ok === true) onClose();
  }, [state, onClose]);

  return (
    <Modal open onClose={onClose} title={`Delete ${year.name}?`}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="yearId" value={year.id} />
        {state.ok === false && (
          <p
            role="alert"
            className="rounded-control bg-danger-50 text-danger-500 px-3.5 py-2.5 text-sm font-medium"
          >
            {state.errors.form}
          </p>
        )}
        <p className="text-ink-soft text-sm">
          This permanently deletes the academic year and its three terms. Subjects, sections,
          schedules and teaching sessions that belong to this year will be deleted with it once
          those features are in use. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button type="submit" variant="danger" loading={pending}>
            Delete academic year
          </Button>
        </div>
      </form>
    </Modal>
  );
}
