"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import type { FormState } from "@/lib/form-state";
import { useOnSuccess } from "@/lib/use-action";
import { errorsOf, FormBanner } from "@/features/classes/FormBanner";
import { saveTask } from "./actions";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from "./constants";
import type { Task } from "./types";

const initial: FormState = {};

export function TaskForm({
  task,
  onDone,
  onCancel,
}: {
  task?: Task;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveTask, initial);
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={task?.id ?? ""} />
      <FormBanner state={state} />
      <Field
        label="Title"
        name="title"
        defaultValue={task?.title ?? ""}
        placeholder="e.g. Grade Grade 7 quizzes"
        error={errors.title}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Category"
          name="category"
          defaultValue={task?.category ?? "teaching"}
          options={TASK_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          error={errors.category}
        />
        <SelectField
          label="Priority"
          name="priority"
          defaultValue={task?.priority ?? "medium"}
          options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
          error={errors.priority}
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={task?.status ?? "todo"}
          options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
          error={errors.status}
        />
        <Field
          label="Due date (optional)"
          name="dueDate"
          type="date"
          defaultValue={task?.dueDate ?? ""}
          error={errors.dueDate}
        />
      </div>
      <TextAreaField
        label="Description (optional)"
        name="description"
        defaultValue={task?.description ?? ""}
        error={errors.description}
      />
      <TextAreaField
        label="Notes (optional)"
        name="notes"
        defaultValue={task?.notes ?? ""}
        error={errors.notes}
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {task ? "Save changes" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
