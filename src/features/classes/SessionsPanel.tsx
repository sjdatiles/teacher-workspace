"use client";

import { CalendarCheck, CheckCheck, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { NoticeBar } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import type { FormState } from "@/lib/form-state";
import { formatDate } from "@/lib/time";
import { useOnSuccess, useRunAction } from "@/lib/use-action";
import {
  bulkCompleteSessions,
  cancelSession,
  completeSession,
  createManualSession,
  deleteManualSession,
  reopenSession,
  rescheduleSession,
  undoReschedule,
  updateActualMinutes,
} from "./actions";
import { SESSION_STATUSES, statusMeta } from "./constants";
import { errorsOf, FormBanner } from "./FormBanner";
import { formatDuration, formatTimeRange } from "./rules";
import type { Section, Session, Subject } from "./types";

const initial: FormState = {};

export type SessionFiltersView = {
  when: "upcoming" | "past" | "all";
  term: string;
  status: string;
  subjectId: string;
  sectionId: string;
};

type Dialog =
  | {
      kind: "complete" | "duration" | "reschedule" | "cancel" | "delete" | "undo";
      session: Session;
    }
  | { kind: "manual" }
  | null;

export function SessionsPanel({
  rows,
  total,
  pageSize,
  page,
  filters,
  subjects,
  sections,
  today,
  pastScheduled,
  hasSchedules,
  canAddManual,
}: {
  rows: Session[];
  total: number;
  pageSize: number;
  page: number;
  filters: SessionFiltersView;
  subjects: Subject[];
  sections: Section[];
  today: string;
  pastScheduled: number;
  hasSchedules: boolean;
  canAddManual: boolean;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { run, pending, notice, clear, show } = useRunAction();

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";
  const section = (id: string) => sections.find((s) => s.id === id);
  const close = () => setDialog(null);

  const eligible = rows.filter((r) => r.status === "scheduled" && r.date <= today);
  const allSelected = eligible.length > 0 && eligible.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const filtered = filters.term || filters.status || filters.subjectId || filters.sectionId;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pageHref = (p: number) => {
    const q = new URLSearchParams({ tab: "sessions", when: filters.when, page: String(p) });
    if (filters.term) q.set("term", filters.term);
    if (filters.status) q.set("status", filters.status);
    if (filters.subjectId) q.set("subject", filters.subjectId);
    if (filters.sectionId) q.set("section", filters.sectionId);
    return `/classes?${q}`;
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft text-sm">
          Every class meeting, planned or taught. Only sessions marked{" "}
          <strong className="text-ink">Completed</strong> count toward your teaching hours and
          reports.
        </p>
        <Button
          size="sm"
          onClick={() => setDialog({ kind: "manual" })}
          disabled={!canAddManual}
          title={canAddManual ? undefined : "Assign a subject to a section first"}
        >
          <Plus className="size-4" aria-hidden /> Add session
        </Button>
      </div>

      {pastScheduled > 0 && (
        <div className="rounded-control bg-warning-50 text-warning-500 mb-4 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-medium">
          <span>
            {pastScheduled} past session{pastScheduled === 1 ? " is" : "s are"} still marked
            Scheduled.
          </span>
          <Link
            href="/classes?tab=sessions&when=past&status=scheduled"
            className="font-bold underline"
          >
            Review and complete them
          </Link>
        </div>
      )}

      <form
        method="get"
        action="/classes"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
      >
        <input type="hidden" name="tab" value="sessions" />
        <SelectField
          label="Period"
          name="when"
          defaultValue={filters.when}
          options={[
            { value: "upcoming", label: "Today onward" },
            { value: "past", label: "Before today" },
            { value: "all", label: "Entire year" },
          ]}
        />
        <SelectField
          label="Term"
          name="term"
          defaultValue={filters.term}
          placeholder="All terms"
          options={[1, 2, 3].map((n) => ({ value: n, label: `Term ${n}` }))}
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={filters.status}
          placeholder="Any status"
          options={SESSION_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
        <SelectField
          label="Subject"
          name="subject"
          defaultValue={filters.subjectId}
          placeholder="All subjects"
          options={subjects.map((s) => ({ value: s.id, label: s.name }))}
        />
        <SelectField
          label="Section"
          name="section"
          defaultValue={filters.sectionId}
          placeholder="All sections"
          options={sections.map((s) => ({ value: s.id, label: s.name }))}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary" className="flex-1">
            Apply
          </Button>
          {(filtered || filters.when !== "upcoming") && (
            <Link
              href="/classes?tab=sessions"
              className="text-brand-700 flex h-11 items-center px-2 text-sm font-semibold"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      <NoticeBar notice={notice} onClose={clear} />

      {eligible.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(eligible.map((r) => r.id)))
              }
              className="accent-brand-500 size-4"
            />
            Select all that can be completed on this page
          </label>
          {selected.size > 0 && (
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                run(
                  () => bulkCompleteSessions([...selected]),
                  () => setSelected(new Set()),
                )
              }
            >
              <CheckCheck className="size-4" aria-hidden /> Mark {selected.size} Completed
            </Button>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="size-8" aria-hidden />}
          title={
            filtered || filters.when !== "upcoming"
              ? "No sessions match these filters"
              : "No upcoming sessions"
          }
          description={
            hasSchedules
              ? "Try another period or clear the filters. Sessions come from your weekly schedules and from sessions you add by hand."
              : "Add a weekly schedule to generate sessions automatically, or add a one-off session such as a make-up class."
          }
        />
      ) : (
        <ul className="divide-line divide-y">
          {rows.map((r) => {
            const meta = statusMeta(r.status);
            const sec = section(r.sectionId);
            return (
              <li key={r.id} className="flex gap-3 py-3.5">
                <div className="w-5 pt-1">
                  {r.status === "scheduled" && r.date <= today && (
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${subjectName(r.subjectId)} on ${formatDate(r.date)}`}
                      className="accent-brand-500 size-4"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink font-bold">{formatDate(r.date)}</span>
                    <span className="text-ink-soft text-sm">
                      {formatTimeRange(r.startTime, r.endTime)}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <Badge tone="neutral">Term {r.termNumber}</Badge>
                    {r.origin === "manual" && <Badge tone="violet">Added by hand</Badge>}
                    {r.origin === "rescheduled" && (
                      <Badge tone="warning">Rescheduled session</Badge>
                    )}
                  </div>
                  <p className="text-ink text-sm font-semibold">
                    {subjectName(r.subjectId)} · {sec?.name ?? "Section"}
                  </p>
                  <p className="text-ink-faint text-xs">
                    {r.status === "completed" && r.actualMinutes !== null
                      ? `Taught for ${formatDuration(r.actualMinutes)}`
                      : `Planned ${formatDuration(r.scheduledMinutes)}`}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {r.status === "scheduled" && (
                      <>
                        {r.date <= today && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setDialog({ kind: "complete", session: r })}
                          >
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDialog({ kind: "reschedule", session: r })}
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDialog({ kind: "cancel", session: r })}
                        >
                          Cancel
                        </Button>
                        {r.origin === "manual" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDialog({ kind: "delete", session: r })}
                          >
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                    {r.status === "completed" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDialog({ kind: "duration", session: r })}
                        >
                          Edit time taught
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => run(() => reopenSession(r.id))}
                        >
                          Reopen
                        </Button>
                      </>
                    )}
                    {r.status === "cancelled" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => run(() => reopenSession(r.id))}
                        >
                          Reopen
                        </Button>
                        {r.origin === "manual" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDialog({ kind: "delete", session: r })}
                          >
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                    {r.status === "rescheduled" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDialog({ kind: "undo", session: r })}
                      >
                        Undo reschedule
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {total > 0 && (
        <div className="border-line mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
          <span className="text-ink-soft">
            Showing {first}–{last} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="rounded-control border-line hover:bg-brand-50 inline-flex h-9 items-center gap-1 border px-3 font-semibold"
              >
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </Link>
            ) : null}
            {last < total ? (
              <Link
                href={pageHref(page + 1)}
                className="rounded-control border-line hover:bg-brand-50 inline-flex h-9 items-center gap-1 border px-3 font-semibold"
              >
                Next <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {dialog?.kind === "manual" && (
        <Modal open onClose={close} title="Add a teaching session">
          <ManualForm
            subjects={subjects}
            sections={sections}
            today={today}
            onDone={(m) => {
              close();
              show(m);
            }}
            onCancel={close}
          />
        </Modal>
      )}

      {dialog?.kind === "complete" && (
        <Modal open onClose={close} title="Mark session Completed">
          <MinutesDialog
            session={dialog.session}
            label="Time actually taught (minutes)"
            submitLabel="Mark Completed"
            pending={pending}
            onClose={close}
            onSubmit={(minutes) => run(() => completeSession(dialog.session.id, minutes), close)}
          />
        </Modal>
      )}
      {dialog?.kind === "duration" && (
        <Modal open onClose={close} title="Edit time taught">
          <MinutesDialog
            session={dialog.session}
            initial={dialog.session.actualMinutes ?? dialog.session.scheduledMinutes}
            label="Time actually taught (minutes)"
            submitLabel="Save"
            pending={pending}
            onClose={close}
            onSubmit={(minutes) =>
              run(() => updateActualMinutes(dialog.session.id, minutes), close)
            }
          />
        </Modal>
      )}
      {dialog?.kind === "reschedule" && (
        <Modal open onClose={close} title="Reschedule session">
          <RescheduleDialog
            session={dialog.session}
            pending={pending}
            onClose={close}
            onSubmit={(d, s, e) => run(() => rescheduleSession(dialog.session.id, d, s, e), close)}
          />
        </Modal>
      )}
      {dialog?.kind === "cancel" && (
        <ConfirmModal
          title="Cancel this session?"
          confirmLabel="Cancel session"
          pending={pending}
          onClose={close}
          onConfirm={() => run(() => cancelSession(dialog.session.id), close)}
        >
          <p>It will not count toward your teaching hours. You can reopen it later.</p>
        </ConfirmModal>
      )}
      {dialog?.kind === "undo" && (
        <ConfirmModal
          title="Undo this reschedule?"
          confirmLabel="Undo reschedule"
          pending={pending}
          onClose={close}
          onConfirm={() => run(() => undoReschedule(dialog.session.id), close)}
        >
          <p>
            The new session is removed and this one becomes Scheduled again. This is only possible
            while the new session is still Scheduled.
          </p>
        </ConfirmModal>
      )}
      {dialog?.kind === "delete" && (
        <ConfirmModal
          title="Delete this session?"
          confirmLabel="Delete session"
          pending={pending}
          onClose={close}
          onConfirm={() => run(() => deleteManualSession(dialog.session.id), close)}
        >
          <p>Only sessions you added by hand can be deleted. This cannot be undone.</p>
        </ConfirmModal>
      )}
    </Card>
  );
}

function MinutesDialog({
  session,
  initial: initialMinutes,
  label,
  submitLabel,
  pending,
  onClose,
  onSubmit,
}: {
  session: Session;
  initial?: number;
  label: string;
  submitLabel: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (minutes: string) => void;
}) {
  const [minutes, setMinutes] = useState(String(initialMinutes ?? session.scheduledMinutes));
  return (
    <div className="space-y-4">
      <p className="text-ink-soft text-sm">
        Planned for {formatDuration(session.scheduledMinutes)}. Change the minutes if the class ran
        shorter or longer.
      </p>
      <Field
        label={label}
        name="minutes"
        type="number"
        inputMode="numeric"
        min={1}
        max={1440}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={pending} onClick={() => onSubmit(minutes)}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function RescheduleDialog({
  session,
  pending,
  onClose,
  onSubmit,
}: {
  session: Session;
  pending: boolean;
  onClose: () => void;
  onSubmit: (date: string, start: string, end: string) => void;
}) {
  const [date, setDate] = useState(session.date);
  const [start, setStart] = useState(session.startTime);
  const [end, setEnd] = useState(session.endTime);
  return (
    <div className="space-y-4">
      <p className="text-ink-soft text-sm">
        The original stays in your history as Rescheduled and is not counted. A new Scheduled
        session is created for the new date.
      </p>
      <Field
        label="New date"
        name="date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Starts"
          name="start"
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <Field
          label="Ends"
          name="end"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={pending} onClick={() => onSubmit(date, start, end)}>
          Reschedule
        </Button>
      </div>
    </div>
  );
}

function ManualForm({
  subjects,
  sections,
  today,
  onDone,
  onCancel,
}: {
  subjects: Subject[];
  sections: Section[];
  today: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(createManualSession, initial);
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);

  const assignable = subjects.filter((s) => s.sectionIds.length > 0);
  const [subjectId, setSubjectId] = useState("");
  const [completed, setCompleted] = useState(false);
  const sectionOptions = sections
    .filter((s) => assignable.find((x) => x.id === subjectId)?.sectionIds.includes(s.id))
    .map((s) => ({ value: s.id, label: `${s.name} (${s.gradeLevel})` }));

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormBanner state={state} />
      <p className="text-ink-soft text-sm">
        For make-up classes, special classes or any class outside your weekly schedule. It follows
        the same counting rules as every other session.
      </p>
      <SelectField
        label="Subject"
        name="subjectId"
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        placeholder="Choose a subject"
        options={assignable.map((s) => ({ value: s.id, label: `${s.name} (${s.gradeLevel})` }))}
        error={errors.subjectId}
        required
      />
      <SelectField
        key={subjectId}
        label="Section"
        name="sectionId"
        placeholder={subjectId ? "Choose a section" : "Choose a subject first"}
        options={sectionOptions}
        error={errors.sectionId}
        required
      />
      <Field label="Date" name="date" type="date" error={errors.date} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" name="startTime" type="time" error={errors.startTime} required />
        <Field label="Ends" name="endTime" type="time" error={errors.endTime} required />
      </div>
      <label className="rounded-control border-line hover:bg-brand-50 flex cursor-pointer items-start gap-2.5 border p-3 text-sm">
        <input
          type="checkbox"
          name="markCompleted"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
          className="accent-brand-500 mt-0.5 size-4"
        />
        <span>
          <span className="block font-semibold">This class was already taught</span>
          <span className="text-ink-faint block text-xs">
            Records it as Completed so it counts in your reports. Dates after {formatDate(today)}{" "}
            cannot be completed yet.
          </span>
        </span>
      </label>
      {completed && (
        <Field
          label="Time actually taught (minutes, optional)"
          name="actualMinutes"
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          error={errors.actualMinutes}
          hint="Leave empty to use the planned duration"
        />
      )}
      <TextAreaField label="Notes (optional)" name="notes" error={errors.notes} />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Add session
        </Button>
      </div>
    </form>
  );
}
