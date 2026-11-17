"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyDbError } from "@/lib/db-error";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { TASK_PRIORITIES, TASK_STATUSES } from "./constants";
import { validateTask, type TaskInput } from "./rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const fail = (message: string): FormState => ({ ok: false, errors: { form: message } });
const done = (message: string): FormState => {
  revalidatePath("/tasks");
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

/** Create a task, or (with id) update every field of one. */
export async function saveTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id");
  if (id && !UUID.test(id)) return fail("Invalid task.");
  const input: TaskInput = {
    title: text(fd, "title"),
    description: text(fd, "description"),
    category: text(fd, "category"),
    status: text(fd, "status") || "todo",
    priority: text(fd, "priority") || "medium",
    dueDate: text(fd, "dueDate"),
    notes: text(fd, "notes"),
  };
  const errors = validateTask(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const row = {
    title: input.title,
    description: input.description,
    category: input.category,
    status: input.status,
    priority: input.priority,
    due_date: input.dueDate || null,
    notes: input.notes,
  };
  const { supabase, userId } = await session();
  if (id) {
    const { data, error } = await supabase
      .from("tasks")
      .update(row)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error) return fail(friendlyDbError(error, "Could not save the task. Please try again."));
    if ((data ?? []).length === 0) return fail("This task no longer exists.");
    return done("Task updated.");
  }
  const { error } = await supabase.from("tasks").insert({ ...row, user_id: userId });
  if (error) return fail(friendlyDbError(error, "Could not save the task. Please try again."));
  return done("Task added.");
}

async function patchTask(
  id: string,
  patch: Record<string, string>,
  success: string,
): Promise<FormState> {
  if (!UUID.test(id)) return fail("Invalid task.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) return fail(friendlyDbError(error, "Could not update the task."));
  if ((data ?? []).length === 0) return fail("This task no longer exists.");
  return done(success);
}

export async function setTaskStatus(id: string, status: string): Promise<FormState> {
  const meta = TASK_STATUSES.find((s) => s.value === status);
  if (!meta) return fail("Choose a valid status.");
  return patchTask(id, { status }, `Moved to ${meta.label}.`);
}

export async function setTaskPriority(id: string, priority: string): Promise<FormState> {
  const meta = TASK_PRIORITIES.find((p) => p.value === priority);
  if (!meta) return fail("Choose a valid priority.");
  return patchTask(id, { priority }, `Priority set to ${meta.label}.`);
}

export async function deleteTask(id: string): Promise<FormState> {
  if (!UUID.test(id)) return fail("Invalid task.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) return fail(friendlyDbError(error, "Could not delete the task."));
  if ((data ?? []).length === 0) return fail("This task no longer exists.");
  return done("Task deleted.");
}
