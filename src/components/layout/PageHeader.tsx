import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <span className="rounded-card bg-brand-500 shadow-card grid size-12 place-items-center text-white">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-ink text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-ink-soft text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}
