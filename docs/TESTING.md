# Testing and acceptance

## Automated (run on every milestone)

| Suite                                                                     | Command                                              | Checks                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Unit tests (rules, recurrence, notifications, reports, tasks, resources…) | `npm test`                                           | 101 tests                                                                                                        |
| Lint / types / build                                                      | `npm run lint && npm run typecheck && npm run build` | clean                                                                                                            |
| Database suites (throw-away local Postgres with all migrations applied)   | `supabase/tests/<name>.test.sh`                      | foundation 31 · classes 85 · calendar 40 · tasks 37 · resources 64 · reports 26 · notifications 19 · security 10 |

Needs PostgreSQL server binaries on PATH and a non-root user: `bash supabase/tests/classes.test.sh`.
The database suites cover three-term validation, session generation, counting rule, rescheduling, ownership and cross-account isolation.

## Render checks (mock backend)

Pages were rendered in headless Chromium at desktop (1280 px) and phone (390 px) widths against a mock Supabase server, checking layout, no horizontal scroll, dialogs, and console errors.
These prove the UI renders and hydrates; **they are not tests against real data.**

## What has NOT been automated

No end-to-end tests against the live site; no load testing; no screen-reader testing; no third-party penetration test.

## Manual live checklist (owner, ~20 minutes, on the live site with a real account)

1. Sign up with a second email, verify it, and confirm it sees none of the first account's data.
2. Settings: create a 2026–2027 year with three terms; try overlapping terms and a term outside the year (should be refused).
3. My Classes: add a subject and a section, assign them, add a Monday schedule → sessions appear.
4. Mark one session Completed, one Cancelled, reschedule one. Reports (that term) must show **1** completed session and its hours only.
5. Calendar: add an event (repeating weekly), edit one occurrence, delete one; check Month/Week/Day.
6. Tasks: add tasks in each status; complete one; confirm Reports numbers did **not** change.
7. Resources: add a link (try `javascript:alert(1)` — must be refused), favorite it, search, filter.
8. Reports: switch Term 1/2/3/Year, custom range, download CSV (opens in Excel), print view.
9. Home: numbers match the modules; bell shows overdue/upcoming items; quick actions open their forms.
10. Phone: repeat 3–9 quickly on a real phone.

## Part 11 acceptance checklist

Legend: **T** = covered by automated tests · **R** = render-checked with mock data · **L** = needs your live check (list above)

### Application foundation

- [x] Secure individual accounts — email verification, RLS (T, L)
- [x] Private workspaces — isolation suites (T, L1)
- [x] Responsive interface (R, L10)
- [x] Six-module navigation (R)
- [x] Consistent design system (R)

### Academic management

- [x] Year creation, configurable dates, exactly three terms, overlap/outside-year validation (T)
- [x] Year selection, active-term identification (T, R, L2)
- [x] Consistent academic filters across modules (R, L)

### My Classes

- [x] Subjects, sections, class population, assignments (T, R)
- [x] Recurring schedules with conflict detection (T)
- [x] Automatic session generation, manual sessions, status management, rescheduling (T)

### Calendar

- [x] Month / Week / Day views (R)
- [x] Event create / edit / delete, repeating events with per-occurrence changes (T, R)
- [x] Teaching schedule integration (same records, no duplicates) (T, R)
- [x] Internal reminders / notification center (T, R)

### Tasks

- [x] CRUD, 5 categories, 4 statuses, 4 priorities, due dates, search/filter, list + board (T, R)

### Resources

- [x] Links only; CRUD, folders, favorites, URL validation, search/filter (T, R)

### Reports

- [x] Completed-only totals and hours, subject / section / term / year / custom range (T)
- [x] CSV export and print view (T for CSV content; R for print)
- [ ] Direct PDF export — **not built** (print → Save as PDF works)

### Quality assurance

- [x] Core workflows tested at the database and rules level (T)
- [x] Account isolation verified (T)
- [x] Database integrity verified (T)
- [x] Responsive behavior rendered (R) — real-device check pending (L10)
- [ ] Live end-to-end pass with real data for M4–M8 — pending the owner checklist above
- [x] Documentation prepared (`docs/`, README)
- [ ] "No critical known defects" — none known, but not proven until the live pass is done

## Known limitations

- Reports cover one academic year at a time (no multi-year totals).
- Tasks board uses "move to" menus, not drag-and-drop.
- Notifications are in-app only.
- Dark mode, direct PDF and Google Calendar sync are future items.
