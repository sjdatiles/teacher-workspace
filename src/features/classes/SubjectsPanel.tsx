"use client";

import { BookOpen, Copy, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useOnSuccess, useRunAction } from "@/lib/use-action";
import { copyFromYear, deleteSubject, saveSubject } from "./actions";
import { GRADE_LEVELS } from "./constants";
import { errorsOf, FormBanner } from "./FormBanner";
import type { Section, Subject } from "./types";

const initial: FormState = {};
const gradeOptions = GRADE_LEVELS.map((g) => ({ value: g, label: g }));

export function SubjectsPanel({
  subjects,
  sections,
  otherYears,
}: {
  subjects: Subject[];
  sections: Section[];
  otherYears: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [copying, setCopying] = useState(false);
  const { run, pending, notice, clear, show } = useRunAction();
  const sectionName = (id: string) => sections.find((s) => s.id === id);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft text-sm">
          The subjects you teach this academic year, and the sections each one is taught to.
        </p>
        <div className="flex gap-2">
          {otherYears.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setCopying(true)}>
              <Copy className="size-4" aria-hidden /> Copy from another year
            </Button>
          )}
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> Add subject
          </Button>
        </div>
      </div>
      <NoticeBar notice={notice} onClose={clear} />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-8" aria-hidden />}
          title="No subjects yet"
          description="Add the subjects you teach this year. Then choose which sections each subject is taught to."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden /> Add subject
            </Button>
          }
        />
      ) : (
        <ul className="divide-line divide-y">
          {subjects.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-ink font-bold">{s.name}</h3>
                  {s.code && <Badge tone="neutral">{s.code}</Badge>}
                  <Badge tone="brand">{s.gradeLevel}</Badge>
                </div>
                {s.description && <p className="text-ink-soft text-sm">{s.description}</p>}
                <p className="text-ink-soft text-sm">
                  {s.sectionIds.length === 0 ? (
                    <span className="text-ink-faint">Not assigned to any section yet</span>
                  ) : (
                    <>
                      Sections:{" "}
                      {s.sectionIds
                        .map((id) => sectionName(id)?.name)
                        .filter(Boolean)
                        .join(", ")}
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(s)}
                  aria-label={`Edit ${s.name}`}
                >
                  <Pencil className="size-4" aria-hidden /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleting(s)}
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 className="size-4" aria-hidden /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing === "new" ? "Add subject" : `Edit ${editing.name}`}
        >
          <SubjectForm
            subject={editing === "new" ? undefined : editing}
            sections={sections}
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
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete subject"
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            run(
              () => deleteSubject(deleting.id),
              () => setDeleting(null),
            )
          }
        >
          <p>
            This removes the subject together with its weekly schedules and its planned sessions.
            Subjects that already have Completed sessions cannot be deleted, because those sessions
            are part of your reports.
          </p>
        </ConfirmModal>
      )}

      {copying && (
        <CopyModal
          years={otherYears}
          pending={pending}
          onClose={() => setCopying(false)}
          onCopy={(fromId) =>
            run(
              () => copyFromYear(fromId),
              () => setCopying(false),
            )
          }
        />
      )}
    </Card>
  );
}

function SubjectForm({
  subject,
  sections,
  onDone,
  onCancel,
}: {
  subject?: Subject;
  sections: Section[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveSubject, initial);
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={subject?.id ?? ""} />
      <FormBanner state={state} />
      <Field
        label="Subject name"
        name="name"
        defaultValue={subject?.name ?? ""}
        placeholder="e.g. Mathematics"
        error={errors.name}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Subject code (optional)"
          name="code"
          defaultValue={subject?.code ?? ""}
          placeholder="e.g. MATH7"
          error={errors.code}
        />
        <SelectField
          label="Grade level"
          name="gradeLevel"
          defaultValue={subject?.gradeLevel ?? ""}
          placeholder="Choose grade level"
          options={gradeOptions}
          error={errors.gradeLevel}
          required
        />
      </div>
      <TextAreaField
        label="Description (optional)"
        name="description"
        defaultValue={subject?.description ?? ""}
        error={errors.description}
      />

      <fieldset className="space-y-2">
        <legend className="text-ink text-sm font-semibold">Taught to these sections</legend>
        {sections.length === 0 ? (
          <p className="text-ink-faint text-sm">
            No sections yet. Add sections in the Sections tab, then edit this subject to assign
            them.
          </p>
        ) : (
          <div className="rounded-control border-line max-h-48 space-y-1 overflow-y-auto border p-2">
            {sections.map((sec) => (
              <label
                key={sec.id}
                className="hover:bg-brand-50 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  name="sectionIds"
                  value={sec.id}
                  defaultChecked={subject?.sectionIds.includes(sec.id)}
                  className="accent-brand-500 size-4"
                />
                <span className="font-medium">{sec.name}</span>
                <span className="text-ink-faint">{sec.gradeLevel}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {subject ? "Save changes" : "Add subject"}
        </Button>
      </div>
    </form>
  );
}

function CopyModal({
  years,
  pending,
  onClose,
  onCopy,
}: {
  years: { id: string; name: string }[];
  pending: boolean;
  onClose: () => void;
  onCopy: (fromId: string) => void;
}) {
  const [from, setFrom] = useState(years[0]?.id ?? "");
  return (
    <Modal open onClose={onClose} title="Copy from another academic year">
      <div className="space-y-4">
        <p className="text-ink-soft text-sm">
          Copies subjects, sections (with their student counts) and which subject is taught to which
          section into the year you are viewing. Schedules and teaching sessions are never copied.
          Anything with the same name and grade level already here is skipped.
        </p>
        <SelectField
          label="Copy from"
          name="from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          options={years.map((y) => ({ value: y.id, label: y.name }))}
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={pending} onClick={() => onCopy(from)}>
            Copy
          </Button>
        </div>
      </div>
    </Modal>
  );
}
