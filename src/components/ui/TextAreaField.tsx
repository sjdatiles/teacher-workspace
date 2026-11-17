import clsx from "clsx";
import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

export function TextAreaField({ label, name, error, hint, className, id, ...rest }: Props) {
  const areaId = id ?? name;
  const describedBy = error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={areaId} className="text-ink block text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={areaId}
        name={name}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "rounded-control bg-surface text-ink placeholder:text-ink-faint w-full border px-3.5 py-2.5 text-sm",
          "focus:border-brand-400 focus:ring-brand-200 focus:ring-2 focus:outline-none",
          error ? "border-danger-500" : "border-line",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${areaId}-error`} className="text-danger-500 text-xs font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${areaId}-hint`} className="text-ink-faint text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
