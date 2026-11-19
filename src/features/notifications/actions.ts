"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";

// Keys look like 'task-overdue:<uuid>', 'task-due:<uuid>:2026-11-20', 'session:<uuid>', 'event:<uuid>:2026-11-20'.
const KEY = /^(session|event|task-due|task-overdue):[0-9a-f-]{36}(:\d{4}-\d{2}-\d{2})?$/i;
const MAX_KEYS = 50;

/** Remembers that notifications were read or dismissed. Ignores anything that is not a real notification key. */
export async function setNotificationState(
  keys: string[],
  state: "read" | "dismissed",
): Promise<{ ok: boolean }> {
  if ((state !== "read" && state !== "dismissed") || !Array.isArray(keys)) return { ok: false };
  const clean = [
    ...new Set(keys.filter((k): k is string => typeof k === "string" && KEY.test(k))),
  ].slice(0, MAX_KEYS);
  if (clean.length === 0) return { ok: true };

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");

  const { error } = await supabase.from("notification_states").upsert(
    clean.map((key) => ({ user_id: user.id, key, state, updated_at: new Date().toISOString() })),
    { onConflict: "user_id,key" },
  );
  if (error) return { ok: false };

  // Old entries are no longer needed (their notifications have long expired).
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  await supabase
    .from("notification_states")
    .delete()
    .eq("user_id", user.id)
    .lt("updated_at", cutoff);

  revalidatePath("/", "layout");
  return { ok: true };
}
