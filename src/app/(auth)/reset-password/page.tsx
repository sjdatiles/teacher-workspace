import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/features/auth/AuthForms";
import { RESET_ALLOWED_COOKIE } from "@/features/auth/recovery";

export const metadata: Metadata = { title: "Set new password" };

/** Reached from the emailed link; the proxy sends visitors without a session to /login. */
export default async function ResetPasswordPage() {
  if ((await cookies()).get(RESET_ALLOWED_COOKIE)?.value !== "1")
    redirect("/forgot-password?expired=1");
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Choose a new password</h1>
      <p className="text-ink-soft mt-1 mb-6 text-sm">
        You&apos;ll be signed out everywhere and asked to log in with the new password.
      </p>
      <ResetPasswordForm />
    </>
  );
}
