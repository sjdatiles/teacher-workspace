import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

/** Labelled text input with inline error/hint. Works in server and client forms. */
export function Field({ label, name, error, hint, className, id, ...rest }: FieldProps) {
  const inputId = id ?? name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-ink block text-sm font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "rounded-control bg-surface text-ink placeholder:text-ink-faint h-11 w-full border px-3.5 text-sm",
          "focus:border-brand-400 focus:ring-brand-200 focus:ring-2 focus:outline-none",
          error ? "border-danger-500" : "border-line",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-danger-500 text-xs font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-ink-faint text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
