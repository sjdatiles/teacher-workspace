import { TERMS, formatHours, type Group } from "./rules";
import type { Totals } from "./types";

/** One colour per term, used everywhere in Reports so a colour always means the same term. */
export const TERM_COLORS = ["#F57F20", "#3B82F6", "#22A06B"] as const;

export function TermLegend() {
  return (
    <ul className="text-ink-soft flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
      {TERMS.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: TERM_COLORS[t - 1] }}
            aria-hidden
          />{" "}
          Term {t}
        </li>
      ))}
    </ul>
  );
}

/** Three columns (Term 1–3) for one measure. Values are printed, so colour is never the only cue. */
export function TermColumns({
  title,
  data,
  format,
  unit,
}: {
  title: string;
  data: { term: 1 | 2 | 3; value: number }[];
  format: (n: number) => string;
  unit: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <figure
      aria-label={`${title}: ${data.map((d) => `Term ${d.term} ${format(d.value)} ${unit}`).join(", ")}`}
    >
      <figcaption className="text-ink mb-3 text-sm font-bold">{title}</figcaption>
      <div className="flex h-44 items-end gap-4 px-2">
        {data.map((d) => (
          <div key={d.term} className="flex h-full flex-1 flex-col justify-end">
            <span className="text-ink mb-1 text-center text-sm font-extrabold">
              {format(d.value)}
            </span>
            <div
              className="rounded-t-md"
              style={{
                height:
                  max === 0 ? "2px" : `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%`,
                minHeight: "2px",
                background: TERM_COLORS[d.term - 1],
              }}
            />
          </div>
        ))}
      </div>
      <div className="border-line mt-1 flex gap-4 border-t px-2 pt-1.5">
        {data.map((d) => (
          <span key={d.term} className="text-ink-soft flex-1 text-center text-xs font-semibold">
            Term {d.term}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** One horizontal bar per group, split into Term 1–3 segments. Totals are printed at the end. */
export function StackedBars({
  groups,
  measure,
}: {
  groups: Group[];
  measure: "sessions" | "minutes";
}) {
  const value = (t: Totals) => t[measure];
  const max = Math.max(...groups.map((g) => value(g.total)), 0);
  const fmt = (n: number) => (measure === "minutes" ? formatHours(n) : String(n));
  return (
    <ul className="space-y-3">
      {groups.map((g) => (
        <li key={g.id} className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3">
          <span className="text-ink truncate text-sm font-semibold" title={g.label}>
            {g.label}
          </span>
          <div
            className="bg-canvas flex h-5 overflow-hidden rounded-md"
            role="img"
            aria-label={`${g.label}: ${TERMS.map((t) => `Term ${t} ${fmt(value(g.terms[t - 1]))}`).join(", ")}`}
          >
            {TERMS.map((t) => {
              const v = value(g.terms[t - 1]);
              return v > 0 && max > 0 ? (
                <div
                  key={t}
                  title={`Term ${t}: ${fmt(v)}`}
                  style={{ width: `${(v / max) * 100}%`, background: TERM_COLORS[t - 1] }}
                />
              ) : null;
            })}
          </div>
          <span className="text-ink w-12 text-right text-sm font-extrabold">
            {fmt(value(g.total))}
          </span>
        </li>
      ))}
    </ul>
  );
}
