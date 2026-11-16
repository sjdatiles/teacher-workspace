"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ALL_NAV } from "./nav";

/**
 * M0 global search: jumps to any module or settings page.
 * Searching records (events, tasks, resources...) is added by the module milestones.
 */
export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_NAV.filter(
      (i) => i.label.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q)),
    );
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length > 0;

  return (
    <div ref={root} className="relative w-full max-w-xl">
      <Search
        className="text-ink-faint pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-label="Search pages"
        placeholder="Search pages"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="rounded-pill border-line bg-surface text-ink shadow-card placeholder:text-ink-faint focus:border-brand-400 focus:ring-brand-200 h-11 w-full border pr-4 pl-10 text-sm focus:ring-2 focus:outline-none"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="rounded-card border-line bg-surface shadow-pop absolute z-50 mt-2 w-full overflow-hidden border p-1.5"
        >
          {results.length === 0 ? (
            <li className="text-ink-soft px-3 py-2.5 text-sm">No matching pages.</li>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={item.href} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item.href)}
                    className={`rounded-control flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm font-semibold ${
                      i === active ? "bg-brand-100/70 text-ink" : "text-ink-soft"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden /> {item.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
