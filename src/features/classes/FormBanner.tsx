import { AlertTriangle } from "lucide-react";
import type { FormState } from "@/lib/form-state";

export const errorsOf = (state: FormState): Record<string, string> =>
  state.ok === false ? state.errors : {};

/** Form-level error and warning messages. */
export function FormBanner({ state }: { state: FormState }) {
  const error = errorsOf(state).form;
  const warnings = state.ok === false ? (state.warnings ?? []) : [];
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-control bg-danger-50 text-danger-500 px-3.5 py-2.5 text-sm font-medium"
        >
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <div
          role="alert"
          className="rounded-control bg-warning-50 text-warning-500 space-y-1 px-3.5 py-2.5 text-sm font-medium"
        >
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-4" aria-hidden /> Schedule clash
          </p>
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p>You can still save it if the overlap is intended.</p>
        </div>
      )}
    </>
  );
}
