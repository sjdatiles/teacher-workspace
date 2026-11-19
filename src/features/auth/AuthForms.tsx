"use client";

import { useActionState, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { changePassword, deleteAccount, logIn, signUp, updateProfile } from "./actions";
import type { FormState } from "./schemas";

const initial: FormState = {};

function errorsOf(state: FormState): Record<string, string> {
  return state.ok === false ? state.errors : {};
}

function FormMessage({ state }: { state: FormState }) {
  const form = errorsOf(state).form;
  if (form) {
    return (
      <p
        role="alert"
        className="rounded-control bg-danger-50 text-danger-500 px-3.5 py-2.5 text-sm font-medium"
      >
        {form}
      </p>
    );
  }
  if (state.ok === true) {
    return (
      <p
        role="status"
        className="rounded-control bg-success-50 text-success-500 px-3.5 py-2.5 text-sm font-medium"
      >
        {state.message}
      </p>
    );
  }
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(logIn, initial);
  const e = errorsOf(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={e.email}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={e.password}
        required
      />
      <Button type="submit" loading={pending} className="w-full">
        Log in
      </Button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initial);
  const e = errorsOf(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Full name" name="fullName" autoComplete="name" error={e.fullName} required />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={e.email}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number."
        error={e.password}
        required
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={e.confirmPassword}
        required
      />
      <Button type="submit" loading={pending} className="w-full">
        Create account
      </Button>
    </form>
  );
}

export function ProfileForm({
  defaults,
}: {
  defaults: { fullName: string; jobTitle: string; schoolName: string; email: string };
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  const e = errorsOf(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        defaultValue={defaults.email}
        disabled
        hint="Your sign-in email cannot be changed here."
      />
      <Field
        label="Full name"
        name="fullName"
        defaultValue={defaults.fullName}
        error={e.fullName}
        required
      />
      <Field
        label="Job title"
        name="jobTitle"
        defaultValue={defaults.jobTitle}
        error={e.jobTitle}
        required
      />
      <Field
        label="School (optional)"
        name="schoolName"
        defaultValue={defaults.schoolName}
        error={e.schoolName}
      />
      <Button type="submit" loading={pending}>
        Save profile
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  const e = errorsOf(state);
  return (
    <form
      action={action}
      className="space-y-4"
      noValidate
      key={state.ok === true ? "done" : "form"}
    >
      <FormMessage state={state} />
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={e.currentPassword}
        required
      />
      <Field
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number."
        error={e.newPassword}
        required
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={e.confirmPassword}
        required
      />
      <Button type="submit" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

/** Danger zone: opens a dialog that asks for the password and the word DELETE. */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, initial);
  const e = errorsOf(state);
  return (
    <div className="space-y-4">
      <p className="text-ink-soft text-sm">
        Permanently delete your account and everything in it: academic years, subjects, sections,
        schedules, teaching sessions and reports, events, tasks and saved links. This cannot be
        undone. Download your reports as CSV first if you want to keep them.
      </p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account…
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <form action={action} className="space-y-4" noValidate>
          <p className="text-ink-soft text-sm">
            All of your data will be erased immediately and you will be signed out. To confirm,
            enter your password and type <strong className="text-ink">DELETE</strong>.
          </p>
          <FormMessage state={state} />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={e.password}
            required
          />
          <Field
            label="Type DELETE to confirm"
            name="confirmation"
            autoComplete="off"
            error={e.confirmation}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Delete everything
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
