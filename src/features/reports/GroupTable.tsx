import { TERMS, formatHours, totalsOf, type Group } from "./rules";

/** Completed sessions per subject or section, by term, with a grand-total row. */
export function GroupTable({
  title,
  firstColumn,
  groups,
}: {
  title: string;
  firstColumn: string;
  groups: Group[];
}) {
  const grand = totalsOf(groups.map((g) => g.total));
  const termTotals = TERMS.map((t) => totalsOf(groups.map((g) => g.terms[t - 1])));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="border-line text-ink-soft border-b text-left text-xs font-bold">
            <th scope="col" className="py-2 pr-3">
              {firstColumn}
            </th>
            {TERMS.map((t) => (
              <th key={t} scope="col" className="px-3 py-2 text-right">
                Term {t}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right">
              Total
            </th>
            <th scope="col" className="py-2 pl-3 text-right">
              Hours
            </th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {groups.map((g) => (
            <tr key={g.id}>
              <th scope="row" className="text-ink py-2.5 pr-3 text-left font-semibold">
                {g.label}
              </th>
              {g.terms.map((t, i) => (
                <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                  {t.sessions}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">
                {g.total.sessions}
              </td>
              <td className="py-2.5 pl-3 text-right tabular-nums">
                {formatHours(g.total.minutes)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-line bg-canvas border-t-2 font-extrabold">
            <th scope="row" className="py-2.5 pr-3 text-left">
              Total
            </th>
            {termTotals.map((t, i) => (
              <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                {t.sessions}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right tabular-nums">{grand.sessions}</td>
            <td className="py-2.5 pl-3 text-right tabular-nums">{formatHours(grand.minutes)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
