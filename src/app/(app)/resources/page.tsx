import clsx from "clsx";
import { ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { RESOURCE_SORTS, RESOURCE_TYPES, type ResourceSort } from "@/features/resources/constants";
import { ResourceLibrary } from "@/features/resources/ResourceLibrary";
import { getAcademicContext } from "@/services/academic";
import {
  RESOURCE_PAGE_SIZE,
  getResourceOverview,
  getResources,
  getSubjectNames,
  getSubjectOptions,
} from "@/services/resources";

export const metadata: Metadata = { title: "Resources" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { selectedYear } = await getAcademicContext();
  const [overview, subjects] = await Promise.all([
    getResourceOverview(),
    getSubjectOptions(selectedYear?.id ?? null),
  ]);

  const rawFolder = one(sp.folder);
  const folder =
    rawFolder === "none" || overview.folders.some((f) => f.id === rawFolder) ? rawFolder : "";
  const q = one(sp.q).trim().slice(0, 100);
  const type = RESOURCE_TYPES.some((t) => t.value === one(sp.type)) ? one(sp.type) : "";
  const subject = UUID.test(one(sp.subject)) ? one(sp.subject) : "";
  const tag = one(sp.tag).trim().toLowerCase().slice(0, 30);
  const favorites = one(sp.fav) === "1";
  const sort = (
    RESOURCE_SORTS.some((s) => s.value === one(sp.sort)) ? one(sp.sort) : "recent"
  ) as ResourceSort;
  const requested = Math.max(1, Math.floor(Number(one(sp.page))) || 1);

  const query = { q, folder, type, subject, tag, favorites, sort };
  let { rows, total } = await getResources({ ...query, page: requested });
  const pages = Math.max(1, Math.ceil(total / RESOURCE_PAGE_SIZE));
  const page = Math.min(requested, pages);
  if (page !== requested) ({ rows, total } = await getResources({ ...query, page }));

  const subjectNames = Object.fromEntries(
    await getSubjectNames(rows.map((r) => r.subjectId).filter((s): s is string => Boolean(s))),
  );

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const all: Record<string, string> = {
      folder,
      q,
      type,
      subject,
      tag,
      fav: favorites ? "1" : "",
      sort: sort === "recent" ? "" : sort,
      ...over,
    };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/resources?${s}` : "/resources";
  };

  const filtered = Boolean(q || type || subject || tag || favorites || folder);
  const selectedFolder = overview.folders.find((f) => f.id === folder) ?? null;
  const tagHref = Object.fromEntries(overview.tags.map((t) => [t, href({ tag: t, page: "" })]));
  const from = total === 0 ? 0 : (page - 1) * RESOURCE_PAGE_SIZE + 1;
  const to = Math.min(page * RESOURCE_PAGE_SIZE, total);

  const stats = [
    { label: "Total resources", value: overview.total },
    { label: "Favorites", value: overview.favorites },
    { label: "Folders", value: overview.folders.length },
    { label: "Tags", value: overview.tags.length },
  ];

  return (
    <>
      <PageHeader
        title="Resource Hub"
        description="Your central library of links to teaching materials and useful resources."
        icon={FolderOpen}
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <dt className="text-ink-soft text-xs font-semibold">{s.label}</dt>
            <dd className="text-ink mt-1 text-2xl font-extrabold">{s.value}</dd>
          </Card>
        ))}
      </dl>

      <ResourceLibrary
        rows={rows}
        folders={overview.folders.map((f) => ({
          ...f,
          href: href({ folder: f.id, page: "" }),
          active: f.id === folder,
        }))}
        allHref={href({ folder: "", page: "" })}
        allActive={folder === ""}
        noFolder={{
          count: overview.unfiled,
          href: href({ folder: "none", page: "" }),
          active: folder === "none",
        }}
        subjects={subjects}
        subjectNames={subjectNames}
        selectedFolder={selectedFolder}
        tagHref={tagHref}
        hasAny={overview.total > 0}
        filtered={filtered}
        autoOpen={one(sp.new) === "1"}
        filters={
          <form
            method="get"
            action="/resources"
            className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <input type="hidden" name="folder" value={folder} />
            <div className="space-y-1.5 lg:col-span-2">
              <label htmlFor="res-q" className="text-ink block text-sm font-semibold">
                Search resources
              </label>
              <input
                id="res-q"
                name="q"
                defaultValue={q}
                placeholder="Title, description or link"
                className="rounded-control bg-surface border-line text-ink placeholder:text-ink-faint focus:border-brand-400 focus:ring-brand-200 h-11 w-full border px-3.5 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <SelectField
              label="Type"
              name="type"
              defaultValue={type}
              placeholder="All types"
              options={RESOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
            <SelectField
              label="Subject"
              name="subject"
              defaultValue={subject}
              placeholder="All subjects"
              options={subjects.map((s) => ({ value: s.id, label: s.label }))}
            />
            <SelectField
              label="Tag"
              name="tag"
              defaultValue={tag}
              placeholder="All tags"
              options={overview.tags.map((t) => ({ value: t, label: `#${t}` }))}
            />
            <SelectField
              label="Sort by"
              name="sort"
              defaultValue={sort}
              options={RESOURCE_SORTS.map((s) => ({ value: s.value, label: s.label }))}
            />
            <label className="text-ink flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                name="fav"
                value="1"
                defaultChecked={favorites}
                className="accent-brand-500 size-4"
              />
              Favorites only
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="secondary">
                Apply
              </Button>
              {(filtered || sort !== "recent") && (
                <Link
                  href="/resources"
                  className="text-brand-700 flex h-11 items-center px-2 text-sm font-semibold"
                >
                  Reset
                </Link>
              )}
            </div>
          </form>
        }
      />

      {total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-ink-soft">
            Showing {from}–{to} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={href({ page: String(page - 1) })}
                className={clsx(
                  "rounded-control border-line hover:bg-brand-50 bg-surface inline-flex h-9 items-center gap-1 border px-3 font-semibold",
                )}
              >
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={href({ page: String(page + 1) })}
                className="rounded-control border-line hover:bg-brand-50 bg-surface inline-flex h-9 items-center gap-1 border px-3 font-semibold"
              >
                Next <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
