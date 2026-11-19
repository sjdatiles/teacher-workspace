"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { fieldErrors } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import {
  deleteAccountSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  signupSchema,
  type FormState,
} from "./schemas";

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.siteUrl}/auth/callback`,
    },
  });

  if (error) return { ok: false, errors: { form: error.message } };

  // Supabase returns a user with no identities when the email is already registered
  // (it does not reveal this by error, to prevent account enumeration).
  if (data.user && data.user.identities?.length === 0) {
    redirect("/auth/check-email");
  }
  redirect("/auth/check-email");
}

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Please verify your email first. Check your inbox for the confirmation link."
        : "Incorrect email or password.";
    return { ok: false, errors: { form: message } };
  }
  redirect("/");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ownership is enforced twice: explicit id filter here, and RLS in the database.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle,
      school_name: parsed.data.schoolName,
    })
    .eq("id", user.id);

  if (error)
    return { ok: false, errors: { form: "Could not save your profile. Please try again." } };
  return { ok: true, message: "Profile updated." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  // Re-authenticate with the current password before allowing a change.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError)
    return { ok: false, errors: { currentPassword: "Current password is incorrect." } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { ok: false, errors: { form: error.message } };
  return { ok: true, message: "Password changed." };
}

/**
 * Permanently deletes the signed-in teacher's account and every record they own.
 * Requires the current password and the typed word DELETE. The deletion itself is a database
 * function that can only remove the caller's own user (see delete_my_account()).
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });
  if (verifyError) return { ok: false, errors: { password: "Password is incorrect." } };

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("delete_my_account failed", error);
    return { ok: false, errors: { form: "Could not delete your account. Please try again." } };
  }

  // The session now points at a user that no longer exists; clear the cookies on this device.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
