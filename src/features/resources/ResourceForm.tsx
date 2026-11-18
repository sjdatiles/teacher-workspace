"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import type { FormState } from "@/lib/form-state";
import { useOnSuccess } from "@/lib/use-action";
import { errorsOf, FormBanner } from "@/features/classes/FormBanner";
import { saveResource } from "./actions";
import { RESOURCE_TYPES } from "./constants";
import { detectType, normalizeUrl } from "./rules";
import type { Folder, Resource, SubjectOption } from "./types";

const initial: FormState = {};

export function ResourceForm({
  resource,
  folders,
  subjects,
  defaultFolderId,
  onDone,
  onCancel,
}: {
  resource?: Resource;
  folders: Folder[];
  subjects: SubjectOption[];
  defaultFolderId?: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveResource, initial);
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);
  const [type, setType] = useState<string>(resource?.type ?? "website");
  const [typeTouched, setTypeTouched] = useState(Boolean(resource));

  // A link to another academic year's subject must stay selectable while editing.
  const subjectOptions =
    resource?.subjectId && !subjects.some((s) => s.id === resource.subjectId)
      ? [...subjects, { id: resource.subjectId, label: "Subject from another academic year" }]
      : subjects;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={resource?.id ?? ""} />
      <FormBanner state={state} />
      <Field
        label="Title"
        name="title"
        defaultValue={resource?.title ?? ""}
        placeholder="e.g. Grade 7 Science reviewer"
        error={errors.title}
        required
      />
      <Field
        label="Link"
        name="url"
        type="text"
        inputMode="url"
        autoComplete="off"
        defaultValue={resource?.url ?? ""}
        placeholder="https://drive.google.com/…"
        error={errors.url}
        hint="Only web links are saved. Files are not uploaded."
        onBlur={(e) => {
          if (!typeTouched) setType(detectType(normalizeUrl(e.currentTarget.value)));
        }}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Type"
          name="type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setTypeTouched(true);
          }}
          options={RESOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          error={errors.type}
        />
        <SelectField
          label="Folder"
          name="categoryId"
          defaultValue={resource?.categoryId ?? defaultFolderId ?? ""}
          placeholder="No folder"
          options={folders.map((f) => ({ value: f.id, label: f.name }))}
        />
        <SelectField
          label="Subject (optional)"
          name="subjectId"
          defaultValue={resource?.subjectId ?? ""}
          placeholder="No subject"
          options={subjectOptions.map((s) => ({ value: s.id, label: s.label }))}
        />
        <Field
          label="Tags (optional)"
          name="tags"
          defaultValue={resource?.tags.join(", ") ?? ""}
          placeholder="math, grade 7"
          error={errors.tags}
          hint="Separate tags with commas."
        />
      </div>
      <TextAreaField
        label="Description (optional)"
        name="description"
        defaultValue={resource?.description ?? ""}
        error={errors.description}
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {resource ? "Save changes" : "Save resource"}
        </Button>
      </div>
    </form>
  );
}
