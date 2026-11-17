"use client";

import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { NoticeBar } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import type { FormState } from "@/lib/form-state";
import { formatRange } from "@/lib/time";
import { useOnSuccess, useRunAction } from "@/lib/use-action";
import { deleteSchedule, saveSchedule } from "./actions";
import { DAYS, dayLabel } from "./constants";
import { errorsOf, FormBanner } from "./FormBanner";
import { formatDuration, formatTimeRange } from "./rules";
import type { Schedule, Section, Subject } from "./types";

const initial: FormState = {};

export type YearInfo = {
  startDate: string;
  endDate: string;
  terms: { termNumber: number; startDate: string; endDate: string }[];
};

export function SchedulesPanel({
  schedules,
  subjects,
  sections,
  year,
  onGoToSubjects,
}: {
  schedules: Schedule[];
  subjects: Subject[];
  sections: Section[];
  year: YearInfo;
  onGoToSubjects: string;
}) {
  const [editing, setEditing] = useState<Schedule | "new" | null>(null);
  const [deleting, setDeleting] = useState<Schedule | null>(null);
  const { run, pending, notice, clear, show } = useRunAction();
  const assignable = subjects.filter((s) => s.sectionIds.length > 0);
  const subjectOf = (id: string) => subjects.find((s) => s.id === id);
  const sectionOf = (id: string) => sections.find((s) => s.id === id);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft text-sm">
          Your recurring weekly classes. Saving a schedule creates a teaching session for every
          matching day inside the terms you choose.
        </p>
        {assignable.length > 0 && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> Add schedule
          </Button>
        )}
      </div>
      <NoticeBar notice={notice} onClose={clear} />

      {assignable.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-8" aria-hidden />}
          title="Assign a subject to a section first"
          description="A weekly schedule is for one subject taught to one section. Add a subject, a section, and assign the subject to the section."
          action={
            <a
              href={onGoToSubjects}
              className="rounded-control bg-brand-500 shadow-card hover:bg-brand-600 inline-flex h-11 items-center px-4 text-sm font-semibold text-white"
            >
              Go to Subjects
            </a>
          }
        />
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-8" aria-hidden />}
          title="No weekly schedule yet"
          description="Add your first recurring class. Its sessions will appear in the Sessions tab."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden /> Add schedule
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {DAYS.filter((d) => schedules.some((s) => s.dayOfWeek === d.value)).map((d) => (
            <section key={d.value} aria-label={d.label}>
              <h3 className="text-brand-700 mb-2 text-sm font-bold tracking-wide uppercase">
                {d.label}
              </h3>
              <ul className="space-y-2">
                {schedules
                  .filter((s) => s.dayOfWeek === d.value)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="rounded-control border-line flex flex-wrap items-start justify-between gap-3 border p-3.5"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-ink font-bold">
                          {subjectOf(s.subjectId)?.name ?? "Subject"} ·{" "}
                          {sectionOf(s.sectionId)?.name ?? "Section"}
                        </p>
                        <p className="text-ink-soft text-sm">
                          {formatTimeRange(s.startTime, s.endTime)} (
                          {formatDuration(s.durationMinutes)})
                        </p>
                        <p className="text-ink-faint text-xs">
                          {formatRange(s.effectiveStart, s.effectiveEnd)}
                        </p>
                        <div className="flex gap-1.5 pt-0.5">
                          {s.termNumbers.map((n) => (
                            <Badge key={n} tone="brand">
                              Term {n}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(s)}
                          aria-label={`Edit ${dayLabel(s.dayOfWeek)} schedule`}
                        >
                          <Pencil className="size-4" aria-hidden /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(s)}
                          aria-label={`Delete ${dayLabel(s.dayOfWeek)} schedule`}
                        >
                          <Trash2 className="size-4" aria-hidden /> Delete
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing === "new" ? "Add weekly schedule" : "Edit weekly schedule"}
        >
          <ScheduleForm
            schedule={editing === "new" ? undefined : editing}
            subjects={assignable}
            sections={sections}
            year={year}
            onDone={(m) => {
              setEditing(null);
              show(m);
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this weekly schedule?"
          confirmLabel="Delete schedule"
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            run(
              () => deleteSchedule(deleting.id),
              () => setDeleting(null),
            )
          }
        >
          <p>
            Its planned (Scheduled) sessions are removed. Sessions you already marked Completed,
            Cancelled or Rescheduled are kept, so your records and reports do not change.
          </p>
        </ConfirmModal>
      )}
    </Card>
  );
}

function ScheduleForm({
  schedule,
  subjects,
  sections,
  year,
  onDone,
  onCancel,
}: {
  schedule?: Schedule;
  subjects: Subject[];
  sections: Section[];
  year: YearInfo;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveSchedule, initial);
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);

  const [subjectId, setSubjectId] = useState(schedule?.subjectId ?? "");
  const sectionOptions = useMemo(() => {
    const subject = subjects.find((s) => s.id === subjectId);
    return sections
      .filter((s) => subject?.sectionIds.includes(s.id))
      .map((s) => ({ value: s.id, label: `${s.name} (${s.gradeLevel})` }));
  }, [subjectId, subjects, sections]);

  const hasWarnings = state.ok === false && (state.warnings?.length ?? 0) > 0;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={schedule?.id ?? ""} />
      <FormBanner state={state} />

      <SelectField
        label="Subject"
        name="subjectId"
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        placeholder="Choose a subject"
        options={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.gradeLevel})` }))}
        error={errors.subjectId}
        required
      />
      <SelectField
        key={subjectId}
        label="Section"
        name="sectionId"
        defaultValue={schedule?.subjectId === subjectId ? schedule.sectionId : ""}
        placeholder={subjectId ? "Choose a section" : "Choose a subject first"}
        options={sectionOptions}
        error={errors.sectionId}
        required
      />
      <SelectField
        label="Day of the week"
        name="dayOfWeek"
        defaultValue={schedule?.dayOfWeek ?? ""}
        placeholder="Choose a day"
        options={DAYS.map((d) => ({ value: d.value, label: d.label }))}
        error={errors.dayOfWeek}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Starts"
          name="startTime"
          type="time"
          defaultValue={schedule?.startTime ?? ""}
          error={errors.startTime}
          required
        />
        <Field
          label="Ends"
          name="endTime"
          type="time"
          defaultValue={schedule?.endTime ?? ""}
          error={errors.endTime}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Effective from"
          name="effectiveStart"
          type="date"
          defaultValue={schedule?.effectiveStart ?? year.startDate}
          min={year.startDate}
          max={year.endDate}
          error={errors.effectiveStart}
          required
        />
        <Field
          label="Effective until"
          name="effectiveEnd"
          type="date"
          defaultValue={schedule?.effectiveEnd ?? year.endDate}
          min={year.startDate}
          max={year.endDate}
          error={errors.effectiveEnd}
          required
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-ink text-sm font-semibold">Applies to</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {year.terms.map((t) => (
            <label
              key={t.termNumber}
              className="rounded-control border-line hover:bg-brand-50 flex cursor-pointer items-start gap-2.5 border p-2.5 text-sm"
            >
              <input
                type="checkbox"
                name="termNumbers"
                value={t.termNumber}
                defaultChecked={schedule ? schedule.termNumbers.includes(t.termNumber) : true}
                className="accent-brand-500 mt-0.5 size-4"
              />
              <span>
                <span className="block font-semibold">Term {t.termNumber}</span>
                <span className="text-ink-faint block text-xs">
                  {formatRange(t.startDate, t.endDate)}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.termNumbers && (
          <p className="text-danger-500 text-xs font-medium">{errors.termNumbers}</p>
        )}
      </fieldset>

      {schedule && (
        <p className="text-ink-faint text-xs">
          Editing only refreshes upcoming Scheduled sessions. Past sessions and anything already
          Completed, Cancelled or Rescheduled stay exactly as they are.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {hasWarnings ? (
          <Button type="submit" name="confirm" value="1" loading={pending}>
            Save anyway
          </Button>
        ) : (
          <Button type="submit" loading={pending}>
            {schedule ? "Save changes" : "Add schedule"}
          </Button>
        )}
      </div>
    </form>
  );
}
