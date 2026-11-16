import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/AuthForms";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="text-ink-soft mt-1 mb-6 text-sm">Log in to your Teacher Workspace.</p>
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
