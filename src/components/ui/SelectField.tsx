import clsx from "clsx";
import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  /** Label of an empty first option (e.g. "Choose a subject"). Omit for no empty option. */
  placeholder?: string;
  options: { value: string | number; label: string }[];
};

/** Labelled native select with inline error/hint, styled like Field. */
export function SelectField({
  label,
  name,
  error,
  hint,
  placeholder,
  options,
  className,
  id,
  ...rest
}: Props) {
  const selectId = id ?? name;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="text-ink block text-sm font-semibold">
        {label}
      </label>
      <select
        id={selectId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "rounded-control bg-surface text-ink h-11 w-full border px-3 text-sm",
          "focus:border-brand-400 focus:ring-brand-200 focus:ring-2 focus:outline-none",
          error ? "border-danger-500" : "border-line",
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-danger-500 text-xs font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-ink-faint text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
