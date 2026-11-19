import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthUser = { id: string; email: string };

/**
 * The signed-in user, or null. Uses getClaims(): with Supabase's asymmetric signing keys the token
 * signature is verified locally (no round trip to Supabase Auth); otherwise it falls back to asking
 * Auth, exactly like getUser(). Either way the token is cryptographically or server verified,
 * never merely read from the cookie. A signed-out token is honoured until it expires (≤ 1 hour).
 * Account-security actions (password change, etc.) still use getUser().
 */
export async function getAuthUser(supabase: SupabaseClient): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const email = data.claims.email;
  return { id: sub, email: typeof email === "string" ? email : "" };
}
