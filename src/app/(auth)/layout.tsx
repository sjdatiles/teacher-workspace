import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="from-brand-50 via-canvas to-brand-100 grid min-h-dvh place-items-center bg-linear-to-br px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/login" className="mb-6 flex justify-center" aria-label="Teacher Workspace">
          <Logo />
        </Link>
        <div className="rounded-card border-line/70 bg-surface shadow-card border p-6 sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
