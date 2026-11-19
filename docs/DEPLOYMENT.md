# Deployment, configuration and backups

## Environment variables

| Name                            | Where                                    | Value                                                                                                    |
| ------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Vercel (all environments) + `.env.local` | Supabase → Project Settings → API → Project URL                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same                                     | the **publishable / anon** key (safe for browsers). Never the secret / service_role key.                 |
| `NEXT_PUBLIC_SITE_URL`          | same                                     | the public site URL, e.g. `https://teacher-workspace-one.vercel.app` (used for email-verification links) |

`NEXT_PUBLIC_SUPABASE_URL` is also used to build the Content-Security-Policy, so set it before building.

## Supabase settings

- Authentication → URL Configuration: Site URL = your site URL; add `<site>/auth/callback` to Redirect URLs.
- Authentication → Email: keep "Confirm email" on.
- Authentication → Password security: enable leaked-password protection.
- Database: apply `supabase/migrations/*` in filename order (already applied to the live project through `20261123000000_m8_hardening.sql`).

## Deploy (Vercel)

1. Import the GitHub repo; framework preset Next.js; build `npm run build`.
2. Add the three environment variables above.
3. Push to `main` → production deploy. Other branches get preview URLs (add their URL to Supabase redirect URLs to test sign-up there).

Local: `cp .env.example .env.local`, fill it in, `npm install`, `npm run dev`.

## Region (speed)

`vercel.json` pins the server functions to `hnd1` (Tokyo), the same region as the Supabase project (`ap-northeast-1`). Keep them together: every page makes several database calls, and a cross-ocean hop on each one makes the site feel slow. If you ever move the Supabase project, change `regions` to match.

## Errors and logging

Server errors surface as friendly messages in the UI; details go to the Vercel function logs (Vercel → project → Logs).
Supabase API/Auth/Postgres logs are in the Supabase dashboard → Logs.

## Backups and recovery

- Supabase takes automated daily backups on paid plans; the free plan has **no** downloadable backups — check your plan.
- Recommended: a weekly `pg_dump` of the `public` schema, stored outside Supabase:
  `pg_dump "$DATABASE_URL" --schema=public --no-owner -Fc -f teacher-workspace-$(date +%F).dump`
  (connection string: Supabase → Project Settings → Database).
- Schema is reproducible from `supabase/migrations/*`; only _data_ needs backing up.
- Restore test: restore a dump into a scratch Supabase project once, before you need it.
- Teachers can export their own reports as CSV at any time.

## Rollback

Vercel → Deployments → promote a previous deployment. Migrations are forward-only; to undo one, write a new migration.

## Not verified

Custom domain, email sender (Supabase's built-in email has low rate limits; configure custom SMTP before many sign-ups), and load testing have not been done.
