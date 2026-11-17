"use client";

import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { NoticeBar } from "@/components/ui/Notice";
import type { FormState } from "@/lib/form-state";
import { formatDate } from "@/lib/time";
import { useOnSuccess, useRunAction } from "@/lib/use-action";
import { addNoClassDay, removeNoClassDay } from "./actions";
import { errorsOf, FormBanner } from "./FormBanner";
import type { NoClassDay } from "./types";

const initial: FormState = {};

export function NoClassDaysPanel({
  days,
  year,
}: {
  days: NoClassDay[];
  year: { startDate: string; endDate: string };
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<NoClassDay | null>(null);
  const { run, pending, notice, clear, show } = useRunAction();

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft text-sm">
          Holidays, breaks and suspensions. Weekly schedules skip these dates, so no session is
          planned on them.
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Add no-class day
        </Button>
      </div>
      <NoticeBar notice={notice} onClose={clear} />

      {days.length === 0 ? (
        <EmptyState
          icon={<CalendarOff className="size-8" aria-hidden />}
          title="No no-class days"
          description="Add holidays or breaks so your generated sessions skip them."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Add no-class day
            </Button>
          }
        />
      ) : (
        <ul className="divide-line divide-y">
          {days.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div>
                <p className="text-ink font-bold">
                  {d.dateFrom === d.dateTo
                    ? formatDate(d.dateFrom)
                    : `${formatDate(d.dateFrom)} – ${formatDate(d.dateTo)}`}
                </p>
                <p className="text-ink-soft text-sm">{d.reason || "No reason given"}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRemoving(d)}
                aria-label={`Remove no-class day ${formatDate(d.dateFrom)}`}
              >
                <Trash2 className="size-4" aria-hidden /> Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <Modal open onClose={() => setAdding(false)} title="Add no-class day">
          <NoClassForm
            year={year}
            onDone={(m) => {
              setAdding(false);
              show(m);
            }}
            onCancel={() => setAdding(false)}
          />
        </Modal>
      )}

      {removing && (
        <ConfirmModal
          title="Remove this no-class day?"
          confirmLabel="Remove"
          pending={pending}
          onClose={() => setRemoving(null)}
          onConfirm={() =>
            run(
              () => removeNoClassDay(removing.id),
              () => setRemoving(null),
            )
          }
        >
          <p>
            Sessions that your weekly schedules would have on those dates will be created again.
          </p>
        </ConfirmModal>
      )}
    </Card>
  );
}

function NoClassForm({
  year,
  onDone,
  onCancel,
}: {
  year: { startDate: string; endDate: string };
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(addNoClassDay, initial);
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormBanner state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="First day"
          name="dateFrom"
          type="date"
          min={year.startDate}
          max={year.endDate}
          error={errors.dateFrom}
          required
        />
        <Field
          label="Last day"
          name="dateTo"
          type="date"
          min={year.startDate}
          max={year.endDate}
          error={errors.dateTo}
          hint="Same as first day for one day"
          required
        />
      </div>
      <Field
        label="Reason (optional)"
        name="reason"
        placeholder="e.g. Christmas break"
        error={errors.reason}
      />
      <p className="text-ink-faint text-xs">
        Planned (Scheduled) sessions on these dates are removed. Anything you already marked
        Completed, Cancelled or Rescheduled is kept.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Add no-class day
        </Button>
      </div>
    </form>
  );
}
