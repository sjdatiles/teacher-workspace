"use client";

import clsx from "clsx";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import type { FormState } from "@/lib/form-state";
import { formatDate } from "@/lib/time";
import { useOnSuccess } from "@/lib/use-action";
import { errorsOf, FormBanner } from "@/features/classes/FormBanner";
import { saveEvent, saveOccurrence } from "./actions";
import {
  COLOR_CLASSES,
  COLOR_KEYS,
  MANUAL_CATEGORIES,
  REMINDER_OPTIONS,
  REPEAT_OPTIONS,
  type RepeatFreq,
} from "./constants";
import type { CalendarEvent, EventOccurrence } from "./types";

const initial: FormState = {};

export type FormMode =
  | { kind: "new"; date: string }
  | { kind: "event"; event: CalendarEvent }
  | { kind: "occurrence"; event: CalendarEvent; occurrence: EventOccurrence };

/**
 * One form for three jobs: a new event, the whole event / series, or a single occurrence of a
 * repeating event. A single occurrence has no category, reminder or repeat settings of its own.
 */
export function EventForm({
  mode,
  onDone,
  onCancel,
}: {
  mode: FormMode;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const isOccurrence = mode.kind === "occurrence";
  const [state, action, pending] = useActionState(
    isOccurrence ? saveOccurrence : saveEvent,
    initial,
  );
  const errors = errorsOf(state);
  useOnSuccess(state, onDone);

  // Starting values
  const src =
    mode.kind === "new"
      ? {
          title: "",
          description: "",
          location: "",
          notes: "",
          startDate: mode.date,
          endDate: mode.date,
          startTime: "08:00" as string | null,
          endTime: "09:00" as string | null,
        }
      : mode.kind === "event"
        ? mode.event
        : mode.occurrence;
  const event = mode.kind === "new" ? null : mode.event;

  const [allDay, setAllDay] = useState(mode.kind !== "new" && src.startTime === null);
  const [repeatFreq, setRepeatFreq] = useState<RepeatFreq>(event?.repeatFreq ?? "none");
  const [color, setColor] = useState(event?.color ?? "");
  const unit = REPEAT_OPTIONS.find((o) => o.value === repeatFreq)?.unit ?? "";

  return (
    <form action={action} className="space-y-4" noValidate>
      {mode.kind === "event" && <input type="hidden" name="id" value={mode.event.id} />}
      {isOccurrence && (
        <>
          <input type="hidden" name="eventId" value={mode.event.id} />
          <input type="hidden" name="occurrenceDate" value={mode.occurrence.occurrenceDate} />
          <p className="bg-brand-50 text-ink-soft rounded-control px-3.5 py-2.5 text-sm">
            You are changing only the occurrence of {formatDate(mode.occurrence.occurrenceDate)}.
            The rest of the series stays the same.
          </p>
        </>
      )}
      {mode.kind === "event" && mode.event.repeatFreq !== "none" && (
        <p className="bg-brand-50 text-ink-soft rounded-control px-3.5 py-2.5 text-sm">
          You are changing every occurrence of this repeating event. Changing the first date or how
          often it repeats clears any single-occurrence changes you made before.
        </p>
      )}
      <FormBanner state={state} />

      <Field
        label="Title"
        name="title"
        defaultValue={src.title}
        placeholder="e.g. PTA meeting"
        error={errors.title}
        required
      />

      {!isOccurrence && (
        <SelectField
          label="Category"
          name="category"
          defaultValue={event?.category ?? "meeting"}
          options={MANUAL_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          error={errors.category}
          hint="Teaching sessions come from My Classes and appear on the calendar automatically."
        />
      )}

      {!isOccurrence && (
        <fieldset className="space-y-2">
          <legend className="text-ink text-sm font-semibold">Color</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "", label: "Default" },
              ...COLOR_KEYS.map((k) => ({ key: k as string, label: COLOR_CLASSES[k].label })),
            ].map((c) => (
              <label key={c.key || "default"} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={c.key}
                  checked={color === c.key}
                  onChange={() => setColor(c.key)}
                  className="peer sr-only"
                />
                <span
                  className={clsx(
                    "rounded-pill peer-checked:ring-brand-500 peer-focus-visible:outline-brand-500 inline-flex items-center gap-2 border border-transparent px-3 py-1.5 text-xs font-semibold ring-1 ring-transparent peer-checked:ring-2 peer-focus-visible:outline-2",
                    c.key
                      ? COLOR_CLASSES[c.key as keyof typeof COLOR_CLASSES].chip
                      : "bg-line/70 text-ink-soft",
                  )}
                >
                  <span
                    className={clsx(
                      "size-2.5 rounded-full",
                      c.key
                        ? COLOR_CLASSES[c.key as keyof typeof COLOR_CLASSES].dot
                        : "bg-ink-faint",
                    )}
                  />
                  {c.label}
                </span>
              </label>
            ))}
          </div>
          {errors.color && <p className="text-danger-500 text-xs font-medium">{errors.color}</p>}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Starts on"
          name="startDate"
          type="date"
          defaultValue={src.startDate}
          error={errors.startDate}
          required
        />
        <Field
          label="Ends on"
          name="endDate"
          type="date"
          defaultValue={src.endDate}
          error={errors.endDate}
          required
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="accent-brand-500 size-4"
        />
        All-day event
      </label>
      {!allDay && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Starts at"
            name="startTime"
            type="time"
            defaultValue={src.startTime ?? "08:00"}
            error={errors.startTime}
            required
          />
          <Field
            label="Ends at"
            name="endTime"
            type="time"
            defaultValue={src.endTime ?? "09:00"}
            error={errors.endTime}
            required
          />
        </div>
      )}

      <Field
        label="Location (optional)"
        name="location"
        defaultValue={src.location}
        placeholder="e.g. Faculty room"
        error={errors.location}
      />
      <TextAreaField
        label="Description (optional)"
        name="description"
        defaultValue={src.description}
        error={errors.description}
      />
      <TextAreaField
        label="Notes (optional)"
        name="notes"
        defaultValue={src.notes}
        error={errors.notes}
      />

      {!isOccurrence && (
        <>
          <SelectField
            label="Reminder"
            name="reminder"
            defaultValue={
              event?.reminderMinutes === null || event === null ? "" : String(event.reminderMinutes)
            }
            options={REMINDER_OPTIONS}
            error={errors.reminder}
            hint="Reminders appear in your notification center."
          />
          <fieldset className="rounded-control border-line space-y-3 border p-3.5">
            <legend className="text-brand-700 px-2 text-sm font-bold">Repeat</legend>
            <SelectField
              label="Repeats"
              name="repeatFreq"
              value={repeatFreq}
              onChange={(e) => setRepeatFreq(e.target.value as RepeatFreq)}
              options={REPEAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              error={errors.repeatFreq}
            />
            {repeatFreq !== "none" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={`Every how many ${unit}s`}
                  name="repeatInterval"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={12}
                  defaultValue={event?.repeatInterval ?? 1}
                  error={errors.repeatInterval}
                />
                <Field
                  label="Repeat until"
                  name="repeatUntil"
                  type="date"
                  defaultValue={event?.repeatUntil ?? ""}
                  error={errors.repeatUntil}
                  hint="At most two years"
                />
              </div>
            )}
          </fieldset>
        </>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {mode.kind === "new" ? "Add event" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
