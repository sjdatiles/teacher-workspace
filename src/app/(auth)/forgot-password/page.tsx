import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/AuthForms";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Forgot your password?</h1>
      <p className="text-ink-soft mt-1 mb-6 text-sm">
        Enter your email and we&apos;ll send you a link to choose a new one.
      </p>
      {expired === "1" && (
        <p
          role="alert"
          className="rounded-control bg-danger-50 text-danger-500 mb-4 px-3.5 py-2.5 text-sm font-medium"
        >
          That reset link is invalid or has expired. Request a new one below, and open it in the
          same browser.
        </p>
      )}
      <ForgotPasswordForm />
      <p className="text-ink-soft mt-6 text-center text-sm">
        Remembered it?{" "}
        <Link href="/login" className="text-brand-600 font-semibold hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
