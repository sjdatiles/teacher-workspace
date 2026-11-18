"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { FormState } from "@/lib/form-state";
import { useOnSuccess } from "@/lib/use-action";
import { errorsOf, FormBanner } from "@/features/classes/FormBanner";
import { saveFolder } from "./actions";

const initial: FormState = {};

export function FolderForm({
  folder,
  onDone,
  onCancel,
}: {
  folder?: { id: string; name: string };
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveFolder, initial);
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={folder?.id ?? ""} />
      <FormBanner state={state} />
      <Field
        label="Folder name"
        name="name"
        defaultValue={folder?.name ?? ""}
        placeholder="e.g. Grade 7 Science"
        error={errors.name}
        required
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {folder ? "Rename folder" : "Create folder"}
        </Button>
      </div>
    </form>
  );
}
