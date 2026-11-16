import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-card border-line/70 bg-surface shadow-card border p-5", className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-ink flex items-center gap-2.5 text-base font-bold">
        {icon && (
          <span className="rounded-control bg-brand-100 text-brand-600 grid size-8 place-items-center">
            {icon}
          </span>
        )}
        {title}
      </h2>
      {action}
    </div>
  );
}
