"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { fieldErrors } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, RESET_ALLOWED_COOKIE } from "./recovery";
import {
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  resetPasswordSchema,
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

/**
 * Sends a password-reset email. The answer is always the same whether or not the address has an
 * account, so this form cannot be used to find out who is registered.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/callback`,
  });
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return {
      ok: false,
      errors: { form: "Too many requests. Please wait a few minutes and try again." },
    };
  }
  if (error) console.error("resetPasswordForEmail failed", error);

  (await cookies()).set(RECOVERY_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return {
    ok: true,
    message:
      "If an account exists for that email, we've sent a reset link. Open it in this same browser. Check your spam folder if it doesn't arrive.",
  };
}

/** Sets the new password for the teacher who arrived through a reset link, then asks them to log in. */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  // Only a session that was just created by a reset link may skip the current-password check.
  const jar = await cookies();
  if (jar.get(RESET_ALLOWED_COOKIE)?.value !== "1") redirect("/forgot-password?expired=1");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?expired=1");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { ok: false, errors: { form: error.message } };
  jar.delete(RESET_ALLOWED_COOKIE);

  // End every session (including the one from the email link) so the new password is used everywhere.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?reset=1");
}
