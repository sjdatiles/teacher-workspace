import type { ReactNode } from "react";

/** Illustration-free, honest empty state. Optional action is a real, working control. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="bg-brand-100 text-brand-600 mb-4 grid size-16 place-items-center rounded-full">
        {icon}
      </div>
      <h2 className="text-ink text-lg font-bold">{title}</h2>
      <p className="text-ink-soft mt-1.5 max-w-md text-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
