import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/features/auth/AuthForms";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
      <p className="text-ink-soft mt-1 mb-6 text-sm">
        Your workspace is private to you. We&apos;ll email a link to verify your address.
      </p>
      <SignupForm />
      <p className="text-ink-soft mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
