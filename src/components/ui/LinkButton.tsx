import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps } from "react";

/** A link that looks like a primary/secondary Button (for navigation, not actions). */
export function LinkButton({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  return (
    <Link
      className={clsx(
        "rounded-control inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-semibold transition-colors",
        variant === "primary"
          ? "bg-brand-500 shadow-card hover:bg-brand-600 text-white"
          : "border-line bg-surface text-ink hover:bg-brand-50 border",
        className,
      )}
      {...rest}
    />
  );
}
