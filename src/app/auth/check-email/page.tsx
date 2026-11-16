import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <main className="from-brand-50 via-canvas to-brand-100 grid min-h-dvh place-items-center bg-linear-to-br px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-card border-line/70 bg-surface shadow-card border p-8">
          <div className="bg-brand-100 text-brand-600 mx-auto mb-4 grid size-16 place-items-center rounded-full">
            <MailCheck className="size-8" aria-hidden />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Check your email</h1>
          <p className="text-ink-soft mt-2 text-sm">
            If that address can be registered, we&apos;ve sent a verification link. Open it to
            activate your account, then log in.
          </p>
          <Link
            href="/login"
            className="rounded-control bg-brand-500 shadow-card hover:bg-brand-600 mt-6 inline-flex h-11 items-center justify-center px-5 text-sm font-semibold text-white"
          >
            Go to log in
          </Link>
        </div>
      </div>
    </main>
  );
}
