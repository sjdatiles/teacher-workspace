import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/AuthForms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; reset?: string }>;
}) {
  const { deleted, reset } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="text-ink-soft mt-1 mb-6 text-sm">Log in to your Teacher Workspace.</p>
      {deleted === "1" && (
        <p
          role="status"
          className="rounded-control bg-success-50 text-success-500 mb-4 px-3.5 py-2.5 text-sm font-medium"
        >
          Your account and all of its data have been deleted.
        </p>
      )}
      {reset === "1" && (
        <p
          role="status"
          className="rounded-control bg-success-50 text-success-500 mb-4 px-3.5 py-2.5 text-sm font-medium"
        >
          Password changed. Log in with your new password.
        </p>
      )}
      <LoginForm />
      <p className="text-ink-soft mt-6 text-center text-sm">
        New here?{" "}
        <Link href="/signup" className="text-brand-600 font-semibold hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
