"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyDbError } from "@/lib/db-error";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { normalizeUrl, parseTags, validateFolderName, validateResource } from "./rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const fail = (message: string): FormState => ({ ok: false, errors: { form: message } });
const done = (message: string): FormState => {
  revalidatePath("/resources");
  revalidatePath("/", "layout");
  return { ok: true, message };
};

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

/** Create a resource link, or (with id) update every field of one. */
export async function saveResource(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id");
  if (id && !UUID.test(id)) return fail("Invalid resource.");
  const categoryId = text(fd, "categoryId");
  const subjectId = text(fd, "subjectId");
  if ((categoryId && !UUID.test(categoryId)) || (subjectId && !UUID.test(subjectId)))
    return fail("Invalid folder or subject.");

  const input = {
    title: text(fd, "title"),
    url: normalizeUrl(text(fd, "url")),
    description: text(fd, "description"),
    type: text(fd, "type") || "website",
    tags: parseTags(text(fd, "tags")),
  };
  const errors = validateResource(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const row = {
    title: input.title,
    url: input.url,
    description: input.description,
    resource_type: input.type,
    category_id: categoryId || null,
    subject_id: subjectId || null,
    tags: input.tags,
  };
  const { supabase, userId } = await session();
  if (id) {
    const { data, error } = await supabase
      .from("resource_links")
      .update(row)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error)
      return fail(friendlyDbError(error, "Could not save the resource. Please try again."));
    if ((data ?? []).length === 0) return fail("This resource no longer exists.");
    return done("Resource updated.");
  }
  const { error } = await supabase.from("resource_links").insert({ ...row, user_id: userId });
  if (error) return fail(friendlyDbError(error, "Could not save the resource. Please try again."));
  return done("Resource saved.");
}

export async function setFavorite(id: string, favorite: boolean): Promise<FormState> {
  if (!UUID.test(id)) return fail("Invalid resource.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("resource_links")
    .update({ is_favorite: favorite })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) return fail(friendlyDbError(error, "Could not update the favorite."));
  if ((data ?? []).length === 0) return fail("This resource no longer exists.");
  return done(favorite ? "Added to favorites." : "Removed from favorites.");
}

export async function deleteResource(id: string): Promise<FormState> {
  if (!UUID.test(id)) return fail("Invalid resource.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("resource_links")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) return fail(friendlyDbError(error, "Could not delete the resource."));
  if ((data ?? []).length === 0) return fail("This resource no longer exists.");
  return done("Resource deleted.");
}

/** Create a folder, or (with id) rename one. */
export async function saveFolder(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id");
  if (id && !UUID.test(id)) return fail("Invalid folder.");
  const name = text(fd, "name");
  const nameError = validateFolderName(name);
  if (nameError) return { ok: false, errors: { name: nameError } };

  const { supabase, userId } = await session();
  if (id) {
    const { data, error } = await supabase
      .from("resource_categories")
      .update({ name })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error)
      return {
        ok: false,
        errors: {
          name: friendlyDbError(error, "Could not rename the folder.").replace(
            "That already exists.",
            "You already have a folder with that name.",
          ),
        },
      };
    if ((data ?? []).length === 0) return fail("This folder no longer exists.");
    return done("Folder renamed.");
  }
  const { error } = await supabase.from("resource_categories").insert({ name, user_id: userId });
  if (error)
    return {
      ok: false,
      errors: {
        name: friendlyDbError(error, "Could not create the folder.").replace(
          "That already exists.",
          "You already have a folder with that name.",
        ),
      },
    };
  return done("Folder created.");
}

/** Deleting a folder keeps its links; they simply become "No folder". */
export async function deleteFolder(id: string): Promise<FormState> {
  if (!UUID.test(id)) return fail("Invalid folder.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("resource_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) return fail(friendlyDbError(error, "Could not delete the folder."));
  if ((data ?? []).length === 0) return fail("This folder no longer exists.");
  return done("Folder deleted. Its links were kept.");
}
