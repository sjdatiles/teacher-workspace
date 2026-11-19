"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";

/** Unchecked checkboxes are absent from FormData, so presence means "on". */
export async function updateNotificationSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("user_settings")
    .update({
      notify_upcoming_sessions: formData.has("upcomingSessions"),
      notify_upcoming_events: formData.has("upcomingEvents"),
      notify_task_deadlines: formData.has("taskDeadlines"),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, errors: { form: "Could not save your preferences." } };
  revalidatePath("/settings");
  return { ok: true, message: "Notification preferences saved." };
}
