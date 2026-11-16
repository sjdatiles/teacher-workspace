import clsx from "clsx";
import type { ReactNode } from "react";

/** Status/priority tones used across modules (task priority, session status, etc.). */
export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "violet";

const tones: Record<Tone, string> = {
  neutral: "bg-line/70 text-ink-soft",
  brand: "bg-brand-100 text-brand-700",
  info: "bg-info-50 text-info-500",
  success: "bg-success-50 text-success-500",
  warning: "bg-warning-50 text-warning-500",
  danger: "bg-danger-50 text-danger-500",
  violet: "bg-violet-50 text-violet-500",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "rounded-pill inline-flex items-center px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
