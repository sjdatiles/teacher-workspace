import type { ResourceSort, ResourceType } from "@/features/resources/constants";
import type { Folder, Resource, SubjectOption } from "@/features/resources/types";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "./teacher";

type Row = {
  id: string;
  title: string;
  url: string;
  description: string;
  resource_type: ResourceType;
  category_id: string | null;
  subject_id: string | null;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
};
const COLS =
  "id, title, url, description, resource_type, category_id, subject_id, tags, is_favorite, created_at";

const toResource = (r: Row): Resource => ({
  id: r.id,
  title: r.title,
  url: r.url,
  description: r.description,
  type: r.resource_type,
  categoryId: r.category_id,
  subjectId: r.subject_id,
  tags: r.tags ?? [],
  isFavorite: r.is_favorite,
  createdAt: r.created_at,
});

export const RESOURCE_PAGE_SIZE = 20;

export type ResourceQuery = {
  q: string;
  /** A folder id, "none" for links without a folder, or "" for all. */
  folder: string;
  type: string;
  subject: string;
  tag: string;
  favorites: boolean;
  sort: ResourceSort;
  page: number;
};

export async function getResources(f: ResourceQuery): Promise<{ rows: Resource[]; total: number }> {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  let q = supabase
    .from("resource_links")
    .select(COLS, { count: "exact" })
    .eq("user_id", teacher.id);
  if (f.folder === "none") q = q.is("category_id", null);
  else if (f.folder) q = q.eq("category_id", f.folder);
  if (f.type) q = q.eq("resource_type", f.type);
  if (f.subject) q = q.eq("subject_id", f.subject);
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.favorites) q = q.eq("is_favorite", true);
  if (f.q) {
    // Characters with a meaning inside PostgREST filters are dropped rather than escaped.
    const safe = f.q.replace(/[%*,()\\"]/g, " ").trim();
    if (safe) q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,url.ilike.%${safe}%`);
  }
  if (f.sort === "title")
    q = q.order("title", { ascending: true }).order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: f.sort === "oldest" }).order("id");

  const from = (f.page - 1) * RESOURCE_PAGE_SIZE;
  const res = await q.range(from, from + RESOURCE_PAGE_SIZE - 1);
  if (res.error) throw new Error("Could not load your resources.");
  return { rows: ((res.data ?? []) as Row[]).map(toResource), total: res.count ?? 0 };
}

export type ResourceOverview = {
  folders: Folder[];
  /** Links with no folder. */
  unfiled: number;
  total: number;
  favorites: number;
  /** Every tag the teacher has used, most common first. */
  tags: string[];
};

/** Folders (created with the six defaults on first visit), their counts, and the overall totals. */
export async function getResourceOverview(): Promise<ResourceOverview> {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  // Creates the default folders once per teacher; a failure here must not hide the page.
  await supabase.rpc("ensure_resource_categories");

  const foldersRes = await supabase
    .from("resource_categories")
    .select("id, name")
    .eq("user_id", teacher.id)
    .order("name");
  if (foldersRes.error) throw new Error("Could not load your folders.");

  // Only small columns are read, in pages, because PostgREST returns at most 1000 rows per request.
  const links: { category_id: string | null; is_favorite: boolean; tags: string[] }[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await supabase
      .from("resource_links")
      .select("category_id, is_favorite, tags")
      .eq("user_id", teacher.id)
      .order("id")
      .range(from, from + 999);
    if (res.error) throw new Error("Could not load your resources.");
    const batch = res.data ?? [];
    links.push(...batch);
    if (batch.length < 1000) break;
  }

  const perFolder = new Map<string, number>();
  const tagCount = new Map<string, number>();
  let unfiled = 0;
  let favorites = 0;
  for (const l of links) {
    if (l.category_id) perFolder.set(l.category_id, (perFolder.get(l.category_id) ?? 0) + 1);
    else unfiled += 1;
    if (l.is_favorite) favorites += 1;
    for (const t of l.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  }
  const tags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);

  return {
    folders: (foldersRes.data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      count: perFolder.get(r.id as string) ?? 0,
    })),
    unfiled,
    total: links.length,
    favorites,
    tags,
  };
}

/** Subjects of the selected academic year, for the subject picker and filter. */
export async function getSubjectOptions(yearId: string | null): Promise<SubjectOption[]> {
  if (!yearId) return [];
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const res = await supabase
    .from("subjects")
    .select("id, name, grade_level")
    .eq("user_id", teacher.id)
    .eq("academic_year_id", yearId)
    .order("grade_level")
    .order("name");
  if (res.error) throw new Error("Could not load your subjects.");
  return (res.data ?? []).map((s) => ({
    id: s.id as string,
    label: `${s.name} (${s.grade_level})`,
  }));
}

/** Names of subjects for links shown on the page, even when they belong to another academic year. */
export async function getSubjectNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const res = await supabase
    .from("subjects")
    .select("id, name")
    .eq("user_id", teacher.id)
    .in("id", unique);
  if (res.error) throw new Error("Could not load your subjects.");
  return new Map((res.data ?? []).map((s) => [s.id as string, s.name as string]));
}
