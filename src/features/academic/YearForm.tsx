"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { FormState } from "@/lib/form-state";
import { saveAcademicYear } from "./actions";
import { TERM_NUMBERS, termField, type AcademicYear } from "./rules";

const initial: FormState = {};

/** Create or edit an academic year and its three terms. All dates are typed by the teacher. */
export function YearForm({ year, onDone }: { year?: AcademicYear; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveAcademicYear, initial);
  const errors = state.ok === false ? state.errors : {};

  useEffect(() => {
    if (state.ok === true) onDone();
  }, [state, onDone]);

  const termOf = (n: number) => year?.terms.find((t) => t.termNumber === n);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="yearId" value={year?.id ?? ""} />

      {errors.form && (
        <p
          role="alert"
          className="rounded-control bg-danger-50 text-danger-500 px-3.5 py-2.5 text-sm font-medium"
        >
          {errors.form}
        </p>
      )}

      <Field
        label="Academic year name"
        name="name"
        defaultValue={year?.name ?? ""}
        placeholder="e.g. 2026–2027"
        error={errors.name}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Year starts"
          name="startDate"
          type="date"
          defaultValue={year?.startDate ?? ""}
          error={errors.startDate}
          required
        />
        <Field
          label="Year ends"
          name="endDate"
          type="date"
          defaultValue={year?.endDate ?? ""}
          error={errors.endDate}
          required
        />
      </div>

      <div className="space-y-4">
        {TERM_NUMBERS.map((n) => (
          <fieldset key={n} className="rounded-control border-line border p-4">
            <legend className="text-brand-700 px-2 text-sm font-bold">Term {n}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Starts"
                name={termField(n, "Start")}
                type="date"
                defaultValue={termOf(n)?.startDate ?? ""}
                error={errors[termField(n, "Start")]}
                required
              />
              <Field
                label="Ends"
                name={termField(n, "End")}
                type="date"
                defaultValue={termOf(n)?.endDate ?? ""}
                error={errors[termField(n, "End")]}
                required
              />
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {year ? "Save changes" : "Create academic year"}
        </Button>
      </div>
    </form>
  );
}
