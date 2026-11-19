# Teacher Workspace

A single workspace for individual teachers: academic years (DepEd three-term), classes and
teaching sessions, calendar, tasks, resources and accomplishment reports.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, RLS, Auth) · Vercel

## Status

M0 (foundation), M1 (academic years, terms, settings), M2 (My Classes), M3 (Calendar), M4 (Tasks), M5 (Resources), M6 (Reports) and M7 (Dashboard and notifications) are built.
M8 (security audit, performance indexes, security headers, documentation) is done; a live end-to-end pass by the owner is still pending.

Docs: [User guide](docs/USER_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Deployment and backups](docs/DEPLOYMENT.md) · [Testing and acceptance](docs/TESTING.md)

Database tests: `supabase/tests/*.test.sh` (foundation, classes, calendar, tasks, resources, reports, notifications, security, account); they need PostgreSQL binaries and a non-root user. Unit tests: `npm test`.

## Getting started

1. `npm install`
2. Create a Supabase project and apply both files in `supabase/migrations/` in order (SQL editor, CLI or MCP). The first is
   `20261116000000_foundation.sql`, the second `20261116010000_harden_foundation.sql`.
3. In Supabase **Authentication → Providers → Email**, keep "Confirm email" **on**, and add
   `http://localhost:3000/auth/callback` (and your production URL) to **Redirect URLs**.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
5. `npm run dev` → http://localhost:3000

## Scripts

| Script           | Purpose                     |
| ---------------- | --------------------------- |
| `npm run dev`    | Development server          |
| `npm run build`  | Production build            |
| `npm test`       | Unit tests (academic rules) |
| `npm run check`  | Lint + typecheck            |
| `npm run format` | Prettier                    |

## Structure

```
src/app/(app)        authenticated pages (shell layout)
src/app/(auth)       login / signup
src/components/ui    design-system primitives (Button, Field, Card, Badge, Modal, EmptyState)
src/components/layout sidebar, top bar, mobile nav, search, notifications, user menu
src/features/<x>     forms, actions and schemas per domain
src/services         server-side data access and ownership checks
src/lib              env, Supabase clients, session proxy
supabase/migrations  SQL schema, constraints, RLS
```

## Non-negotiable rules

- Exactly three terms per academic year (Term 1–3); never quarters.
- Only sessions with status Completed count toward reports and hours.
- Teacher data is private: enforced in server code **and** by Postgres RLS.
