"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { TERM_NUMBERS, termField, validateYear, type YearInput } from "./rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Create (no yearId) or update (yearId) an academic year together with its three terms. */
export async function saveAcademicYear(_prev: FormState, formData: FormData): Promise<FormState> {
  const yearId = text(formData, "yearId");
  if (yearId && !UUID.test(yearId))
    return { ok: false, errors: { form: "Invalid academic year." } };

  const input: YearInput = {
    name: text(formData, "name"),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate"),
    terms: TERM_NUMBERS.map((n) => ({
      termNumber: n,
      startDate: text(formData, termField(n, "Start")),
      endDate: text(formData, termField(n, "End")),
    })),
  };

  const errors = validateYear(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const { supabase, userId } = await currentUserId();

  // One database transaction: the year and all three terms are saved together or not at all.
  const { data: savedId, error } = await supabase.rpc("save_academic_year", {
    p_year_id: yearId || null,
    p_name: input.name,
    p_start: input.startDate,
    p_end: input.endDate,
    p_terms: input.terms.map((t) => ({
      term_number: t.termNumber,
      start_date: t.startDate,
      end_date: t.endDate,
    })),
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, errors: { name: "You already have an academic year with this name." } };
    }
    if (error.code === "23514" || error.code === "23P01") {
      return { ok: false, errors: { form: error.message } };
    }
    if (error.code === "P0002") {
      return { ok: false, errors: { form: "This academic year no longer exists." } };
    }
    return { ok: false, errors: { form: "Could not save the academic year. Please try again." } };
  }

  // A teacher's first year becomes the one they are viewing.
  if (!yearId && savedId) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("selected_academic_year_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!settings?.selected_academic_year_id) {
      await supabase
        .from("user_settings")
        .update({ selected_academic_year_id: savedId })
        .eq("user_id", userId);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, message: yearId ? "Academic year updated." : "Academic year created." };
}

/** Switch the academic year every module shows. */
export async function selectAcademicYear(yearId: string): Promise<void> {
  if (!UUID.test(yearId)) return;
  const { supabase, userId } = await currentUserId();
  // The composite foreign key (year id, user id) rejects another teacher's year.
  await supabase
    .from("user_settings")
    .update({ selected_academic_year_id: yearId })
    .eq("user_id", userId);
  revalidatePath("/", "layout");
}

export async function deleteAcademicYear(_prev: FormState, formData: FormData): Promise<FormState> {
  const yearId = text(formData, "yearId");
  if (!UUID.test(yearId)) return { ok: false, errors: { form: "Invalid academic year." } };

  const { supabase, userId } = await currentUserId();
  const { error } = await supabase
    .from("academic_years")
    .delete()
    .eq("id", yearId)
    .eq("user_id", userId);
  if (error) return { ok: false, errors: { form: "Could not delete the academic year." } };

  revalidatePath("/", "layout");
  return { ok: true, message: "Academic year deleted." };
}
