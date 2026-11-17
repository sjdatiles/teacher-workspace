import clsx from "clsx";
import Link from "next/link";

export type TabItem = { key: string; label: string; href: string; count?: number };

/** Link-based tabs: the active tab lives in the URL, so reload and back/forward just work. */
export function Tabs({
  items,
  active,
  label,
}: {
  items: TabItem[];
  active: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="border-line mb-5 flex gap-1 overflow-x-auto border-b">
      {items.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={clsx(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors",
              isActive
                ? "border-brand-500 text-brand-700"
                : "text-ink-soft hover:text-ink border-transparent",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="bg-brand-100 text-brand-700 rounded-pill px-2 py-0.5 text-xs">
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
