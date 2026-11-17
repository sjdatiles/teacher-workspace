"use client";

import { Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { deleteSection, saveSection } from "./actions";
import { GRADE_LEVELS } from "./constants";
import { errorsOf, FormBanner } from "./FormBanner";
import type { Section, Subject } from "./types";

const initial: FormState = {};
const gradeOptions = GRADE_LEVELS.map((g) => ({ value: g, label: g }));

export function SectionsPanel({
  sections,
  subjects,
}: {
  sections: Section[];
  subjects: Subject[];
}) {
  const [editing, setEditing] = useState<Section | "new" | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const { run, pending, notice, clear, show } = useRunAction();
  const totalStudents = sections.reduce((n, s) => n + s.population, 0);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft text-sm">
          Class sections and how many students are enrolled in each. Only the head count is kept,
          never individual students.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> Add section
        </Button>
      </div>
      <NoticeBar notice={notice} onClose={clear} />

      {sections.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title="No sections yet"
          description="Add the class sections you handle and the number of enrolled students in each."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden /> Add section
            </Button>
          }
        />
      ) : (
        <>
          <ul className="divide-line divide-y">
            {sections.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-ink font-bold">{s.name}</h3>
                    <Badge tone="brand">{s.gradeLevel}</Badge>
                    <Badge tone="neutral">
                      {s.population} student{s.population === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  {s.description && <p className="text-ink-soft text-sm">{s.description}</p>}
                  <p className="text-ink-soft text-sm">
                    {s.subjectIds.length === 0 ? (
                      <span className="text-ink-faint">No subjects assigned yet</span>
                    ) : (
                      <>
                        Subjects:{" "}
                        {s.subjectIds
                          .map((id) => subjects.find((x) => x.id === id)?.name)
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
          <p className="text-ink-soft border-line mt-2 border-t pt-3 text-sm">
            Total students across your sections:{" "}
            <strong className="text-ink">{totalStudents}</strong>
          </p>
        </>
      )}

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing === "new" ? "Add section" : `Edit ${editing.name}`}
        >
          <SectionForm
            section={editing === "new" ? undefined : editing}
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
          confirmLabel="Delete section"
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            run(
              () => deleteSection(deleting.id),
              () => setDeleting(null),
            )
          }
        >
          <p>
            This removes the section together with its weekly schedules and planned sessions.
            Sections that already have Completed sessions cannot be deleted, because those sessions
            are part of your reports.
          </p>
        </ConfirmModal>
      )}
    </Card>
  );
}

function SectionForm({
  section,
  onDone,
  onCancel,
}: {
  section?: Section;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveSection, initial);
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={section?.id ?? ""} />
      <FormBanner state={state} />
      <Field
        label="Section name"
        name="name"
        defaultValue={section?.name ?? ""}
        placeholder="e.g. Sampaguita"
        error={errors.name}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Grade level"
          name="gradeLevel"
          defaultValue={section?.gradeLevel ?? ""}
          placeholder="Choose grade level"
          options={gradeOptions}
          error={errors.gradeLevel}
          required
        />
        <Field
          label="Enrolled students"
          name="population"
          type="number"
          inputMode="numeric"
          min={0}
          max={200}
          defaultValue={section?.population ?? ""}
          error={errors.population}
          hint="Head count only"
          required
        />
      </div>
      <TextAreaField
        label="Description (optional)"
        name="description"
        defaultValue={section?.description ?? ""}
        error={errors.description}
      />
      <p className="text-ink-faint text-xs">
        Assign subjects to this section from the Subjects tab.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {section ? "Save changes" : "Add section"}
        </Button>
      </div>
    </form>
  );
}
