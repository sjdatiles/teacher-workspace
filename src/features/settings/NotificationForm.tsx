"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { FormState } from "@/lib/form-state";
import type { NotificationSettings } from "@/services/academic";
import { updateNotificationSettings } from "./actions";

const initial: FormState = {};

const options = [
  { name: "upcomingSessions", key: "upcomingSessions", label: "Upcoming teaching sessions" },
  { name: "upcomingEvents", key: "upcomingEvents", label: "Upcoming calendar events" },
  { name: "taskDeadlines", key: "taskDeadlines", label: "Task deadlines and overdue tasks" },
] as const;

export function NotificationForm({ defaults }: { defaults: NotificationSettings }) {
  const [state, action, pending] = useActionState(updateNotificationSettings, initial);
  return (
    <form action={action} className="space-y-4">
      {state.ok === false && (
        <p
          role="alert"
          className="rounded-control bg-danger-50 text-danger-500 px-3.5 py-2.5 text-sm font-medium"
        >
          {state.errors.form}
        </p>
      )}
      {state.ok === true && (
        <p
          role="status"
          className="rounded-control bg-success-50 text-success-500 px-3.5 py-2.5 text-sm font-medium"
        >
          {state.message}
        </p>
      )}
      <p className="text-ink-soft text-sm">
        Choose which reminders appear in your notification center. They are shown inside the app
        only.
      </p>
      <ul className="space-y-3">
        {options.map((o) => (
          <li key={o.name}>
            <label className="text-ink flex cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                name={o.name}
                defaultChecked={defaults[o.key]}
                className="border-line accent-brand-500 size-5 rounded"
              />
              {o.label}
            </label>
          </li>
        ))}
      </ul>
      <Button type="submit" loading={pending}>
        Save preferences
      </Button>
    </form>
  );
}
