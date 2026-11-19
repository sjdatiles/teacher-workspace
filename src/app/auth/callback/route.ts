import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { RECOVERY_COOKIE, RESET_ALLOWED_COOKIE } from "@/features/auth/recovery";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing page for emailed links: exchanges the one-time code for a session.
 * A password-reset link is recognised by the short-lived cookie set when the reset was requested
 * (the code can only be exchanged in the same browser anyway). The destination is fixed in code,
 * never taken from the URL, so this cannot be used as an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const jar = await cookies();
  const recovery = jar.get(RECOVERY_COOKIE)?.value === "1";

  let ok = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  if (recovery) {
    jar.delete(RECOVERY_COOKIE);
    if (ok) {
      jar.set(RESET_ALLOWED_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60,
      });
    }
  }

  if (recovery) {
    return NextResponse.redirect(
      `${origin}${ok ? "/reset-password" : "/forgot-password?expired=1"}`,
    );
  }
  return NextResponse.redirect(`${origin}${ok ? "/" : "/login"}`);
}
