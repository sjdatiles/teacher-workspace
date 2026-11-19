# Security

## Model

1. **Authentication** — Supabase Auth, email + password with email verification. Sessions are cookies refreshed by `src/proxy.ts`; the server never trusts the cookie alone: `getClaims()` verifies the token signature (locally with Supabase's signing keys, or by asking Auth when the project uses a shared secret). Password and account changes use `getUser()`, which always asks Auth. Trade-off: after signing out elsewhere, an old token stays valid until it expires (at most one hour).
2. **Authorization** — three independent layers:
   - `proxy.ts` redirects signed-out visitors to `/login`.
   - Every service and Server Action loads the teacher and filters by `user_id`; ids from forms are UUID-validated.
   - **Row-level security** on every table: policies compare `user_id` to `auth.uid()`. This holds even if application code were wrong.
3. **No privileged key in the app.** The app uses only the public (publishable / anon) key. The `service_role` key is never used or stored.
4. **Anonymous access** — the `anon` role has no table privileges and cannot execute any function in `public`.
5. **Database functions** — `SECURITY INVOKER` with `search_path` pinned; the only `SECURITY DEFINER` function is the new-user profile trigger.

## Password reset

`Forgot password?` → `resetPasswordForEmail` (Supabase sends the email; the reply never reveals whether an address is registered). The emailed link returns to `/auth/callback`, which exchanges the one-time code and — only if this browser requested the reset (httpOnly cookie, 1 h) — sets a 15-minute `tw-reset-allowed` cookie and sends the teacher to `/reset-password`. The page and the action both require that cookie, so an ordinary signed-in session cannot use the reset form to skip the current-password check. After the change every session is revoked (`signOut` global) and the teacher logs in again. Redirect targets are fixed in code, never read from the URL. Supabase enforces email rate limits.

## Account deletion

Settings → Delete account asks for the password (re-checked server-side) and the typed word `DELETE`, then calls the database function `delete_my_account()`. The app has no `service_role` key, so this function is `SECURITY DEFINER` and can only delete **the caller's own** user (`auth.uid()`); signed-out callers are refused. All teacher tables cascade from `auth.users`, so everything is removed. Supabase's advisor flags the function as "executable by signed-in users"; that is intentional. Trade-off: a stolen _signed-in session_ could call the function directly without the password, but such a session could already erase the same data through the normal API.

## HTTP hardening (next.config.ts)

CSP (self + this project's Supabase URL only, no framing, no plugins), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, mic, geolocation, payment off),
HSTS, and `X-Powered-By` removed.
Known trade-off: `script-src` allows `'unsafe-inline'` because Next.js inlines bootstrap scripts; a nonce-based CSP is a possible later tightening.

## Input handling

- Resource links accept only `http(s)` URLs and open with `rel="noopener noreferrer"`.
- Search text is stripped of PostgREST filter characters before use in `ilike` filters.
- CSV export neutralises cells starting with `=`, `+`, `-`, `@` (spreadsheet formula injection).
- React escapes all rendered text; the code base has no `dangerouslySetInnerHTML`.

## Verified in M8

| Check                                                                                            | How                                                    | Result                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Every public table has RLS and policies; all policies use `auth.uid()`; none open to anon/public | live catalog query + `supabase/tests/security.test.sh` | pass                                                              |
| Cross-account isolation (read, write, move rows) per module                                      | the seven module `*.test.sh` suites                    | pass                                                              |
| Supabase security advisor                                                                        | `get_advisors`                                         | only "Leaked password protection disabled" (owner setting, below) |
| Dependencies                                                                                     | `npm audit --omit=dev`                                 | 0 vulnerabilities                                                 |
| Secrets in repo                                                                                  | `git grep` for service-role / secret key patterns      | none; only `.env.example` is tracked                              |
| Security headers                                                                                 | `curl -I` against the production build                 | present                                                           |

## Owner actions

- Enable **Leaked password protection**: Supabase Dashboard → Authentication → Sign In / Providers → Password security (may require a paid Supabase plan).
- Keep `.env.local` out of git (it is ignored).
- Never paste the `service_role` / secret key anywhere.

## Not covered

No penetration test by a third party, no rate-limit tuning beyond Supabase Auth defaults, no automated end-to-end tests against the live site.
