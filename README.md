# Ready2Rent

**Vacation rental turnovers, finally in sync.**
_From checkout to clean — and everything in between._

Ready2Rent sits between rental booking platforms (Airbnb, Vrbo) and the people who
do the turnover work (cleaners, linen services). Hosts connect their booking
calendars via iCal; Ready2Rent pulls reservations on a schedule and converts every
checkout into a scheduled cleaning job that cleaners see in real time — with
checklists, photo proof, problem reports, inventory, and payment tracking.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Database | PostgreSQL (Supabase) via Prisma 6 |
| Auth | NextAuth / Auth.js v5 (credentials + JWT sessions) |
| Styling | Tailwind CSS 3 — tokenized coastal theme with **light + dark mode**, Plus Jakarta Sans |
| Object storage | Supabase Storage (job photos, property images, receipts) |
| Calendar parsing | `node-ical` |
| Email | Resend (invitations + owner notifications), no-ops without keys |
| Background sync | Cron worker / scheduled `GET /api/cron/sync` |

The sync layer is built behind a **provider abstraction** so direct APIs
(Airbnb/Vrbo/Guesty/Hostaway/…) can be added later without changing the
reservation/job model.

---

## Features

**Turnover engine**
- Airbnb/Vrbo **iCal calendar sync** → one scheduled turnover job per reservation.
- **Same-day turnover** detection and highlighting; date-change propagation;
  auto-cancel when a reservation vanishes; cross-feed duplicate flagging.
- Job lifecycle: scheduled → in progress → completed / problem / canceled, with
  full **status history**.
- **Manual complete / cancel** with a status lock (a deliberate override survives
  the next sync), and **reopen** to undo an accidental complete/cancel.

**On the ground**
- Per-property **checklists** (hosts or cleaners author them; cleaners tick items
  off per job).
- **Completion photos** and **problem reports** with photo evidence + host-visible
  notes.
- Per-property **inventory** (supplies + linens) with low-stock par levels.

**People & accounts**
- **Host ↔ cleaner invitations** by email; accepting links the account to the
  property/org (co-host join, or ownership transfer for cleaner-created properties).
- Cleaner-led onboarding: a cleaner adds a property, the off-platform owner gets
  nudge emails and can **claim** it via an unguessable link.
- Per-user **notification preferences**.
- **Guided setup** on the host dashboard (add property → connect calendar → watch
  turnovers appear), which hides itself once complete.

**Financials** (manual tracking; Stripe automation later)
- **Payments** per property (optionally linked to a job): amount, method (Apple
  Pay / Venmo / Cash App / Zelle / Cash / Other), status (Due / Paid / Canceled),
  due & paid dates, reference. Completing a clean **auto-creates a payment due**
  from the property's cleaning price.
- **Expenses** per property with category, vendor, and an uploaded **receipt**
  (image/PDF).
- A **Financials** dashboard (outstanding / paid / expenses, per-property
  breakdown) plus an outstanding tile on the host dashboard and a snapshot on each
  property.

**Experience**
- **Light + dark mode** (system-aware, persisted, no flash) driven at the design-
  token layer.
- **⌘K / Ctrl-K command palette** for fast navigation + quick actions.
- Custom **brand** (logo mark + wordmark, favicon) and a redesigned marketing
  landing page.
- Role-aware dashboards for **Host / Cleaner / Admin** with analytics.

---

## Getting started

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
#   Core:
#   - DATABASE_URL / DIRECT_URL   (Supabase pooled + direct connection strings)
#   - AUTH_SECRET                 (openssl rand -base64 32)
#   - FEED_ENCRYPTION_KEY         (openssl rand -hex 32  -> 64 hex chars)
#   - CRON_SECRET                 (openssl rand -hex 32)
#   - AUTH_URL / NEXT_PUBLIC_APP_URL  (base URL used in email links)
#   Object storage (photos, receipts) — optional; falls back to /public/uploads in dev:
#   - NEXT_PUBLIC_SUPABASE_URL
#   - SUPABASE_SERVICE_ROLE_KEY
#   - SUPABASE_STORAGE_BUCKET     (default "job-photos")
#   Email — optional; invites/notifications are logged-and-skipped without these:
#   - RESEND_API_KEY
#   - EMAIL_FROM

# 3. Create the schema
npm run db:push          # or: npm run db:migrate

# 4. (optional) create the storage bucket
npm run setup:storage

# 5. Seed demo data — requires an explicit password; never runs in production
SEED_PASSWORD='choose-a-strong-one' npm run db:seed

# 6. Run
npm run dev              # http://localhost:3000
```

### Demo accounts (after seeding)

Seeded users use the `SEED_PASSWORD` you provide (there is **no default**, and the
seed refuses to run against `NODE_ENV=production` unless `ALLOW_PROD_SEED=true`).

| Role | Email |
|---|---|
| Host / Owner | `owner@ready2rent.io` |
| Cleaner | `cleaner@ready2rent.io` |
| Admin | `admin@ready2rent.io` |

> These are development fixtures. Do not seed them into a production database.

### Recurring sync

- **Local / self-hosted:** `npm run sync:worker` (polls every 15 min).
- **Scheduled:** point any cron at `GET /api/cron/sync` (every ~15 min) with an
  `Authorization: Bearer $CRON_SECRET` header.
- **Manual:** hosts can "Sync now" on a property; admins can sync any/all feeds
  from **Sync health**.

### Manual migrations

Schema is Prisma-first (`npm run db:push`). Additive, hand-written SQL for features
shipped incrementally lives in [`prisma/manual-migrations/`](prisma/manual-migrations)
(checklists, inventory, invitations, notification preferences, job status lock,
financials) — each is idempotent and enables RLS to match the rest of the schema.

---

## Architecture

```
Booking platform (Airbnb/Vrbo)
        │  public iCal/ICS export URL
        ▼
ReservationProvider  ──►  ICalReservationProvider   (Phase 1)
   interface              AirbnbApiReservationProvider (later)
        │
        ▼
  Sync service  ── fetch → normalize → diff → persist → flag vanished → dedupe
        │
        ▼
 Turnover job generator  ── one job per reservation, same-day detection,
        │                    date-change propagation, cancel-on-removal
        ▼
   Dashboards (Host / Cleaner / Admin)  +  Notifications  +  Financials
```

### Key directories

```
prisma/schema.prisma            Full data model
prisma/manual-migrations/       Idempotent additive SQL for incremental features
src/server/providers/           Provider abstraction + ICalReservationProvider
src/server/sync/                sync-service, job-generator, duplicates, worker, cleanup
src/server/queries.ts           Role-scoped read models for dashboards
src/server/actions.ts           Server actions (mutations: jobs, checklists, inventory,
                                invitations, financials, …)
src/server/financials.ts        Financial read models (payments/expenses aggregates)
src/server/onboarding.ts        Host guided-setup progress
src/server/invitations.ts       Invite email + acceptance (co-host / ownership transfer)
src/server/notifications.ts     In-app notifications
src/lib/                        prisma, crypto (feed encryption), storage, rbac,
                                status, money, datetime
src/components/                 AppShell, Logo, ThemeToggle, CommandPalette,
                                OnboardingChecklist, JobCalendar, FinancialsManager, …
src/app/(auth)/                 Login / signup
src/app/(app)/                  Authenticated app (dashboards, properties, jobs,
                                financials, analytics, admin)
src/app/api/cron/               Recurring sync + archive cleanup endpoints
src/app/api/jobs/[id]/photos/   Completion / problem photo upload
src/app/p/[token]/              Public property status page (owner claim funnel)
```

### Security model

- Calendar feed URLs are **encrypted at rest** (AES-256-GCM, `src/lib/crypto.ts`)
  and **never logged** (only the host appears in sync errors).
- We never ask for or store Airbnb/Vrbo credentials — iCal links only, no scraping.
- **Role-based access control** (`src/lib/rbac.ts`): hosts see only their
  properties, cleaners only assigned properties/jobs, admins platform-wide. Every
  financial and property mutation is gated by `canAccessProperty` / `canAccessJob`.
- Postgres RLS is enabled on all tables (Prisma connects as the table owner and
  bypasses it; the app layer is the authorization boundary).
- The seed script requires an explicit `SEED_PASSWORD` and refuses to run in
  production — no baked-in demo credentials.
- Cron endpoints are guarded by `CRON_SECRET`. Manual sync triggers are
  rate-limited with a per-feed cooldown.
- **Known follow-up:** uploaded receipts currently live in the public storage
  bucket (unguessable URLs). Moving them to a private bucket with signed URLs is a
  tracked hardening item.

---

### Performance

Hosted on Netlify (functions in us-east-2) + Supabase Postgres (us-east-1,
co-located). Warm dashboard load is ~0.4s. Key choices, the hard-won ones:
`connection_limit=8` on the pooled URL (so `Promise.all` queries don't
serialize), relation-scoped dashboard queries (one parallel batch, no serial
id-prefetch), DB co-located with the function region (a cross-region hop was
~260ms/query), plus `loading.tsx` skeletons, `useFormStatus` submit spinners,
and a short `staleTimes` router cache for instant-feeling navigation. Details and
the region-migration script in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#8-performance--infrastructure).

## Business rules

- A reservation creates exactly **one** turnover job (keyed by reservation id → no
  duplicates on re-sync).
- The job is anchored to the **checkout** instant; the **next check-in** is the
  earliest other live reservation on the property.
- **Same-day turnover** (new guest checks in the same day) is flagged and
  visually highlighted everywhere.
- Reservation **date changes** propagate to the job unless it's already
  `COMPLETED` or manually locked.
- A reservation that **vanishes** from the feed → `POSSIBLY_CANCELED`; its job is
  `CANCELED` (unless completed). **History is never auto-deleted.**
- **Manual overrides** (complete / cancel) set a status lock so a later sync won't
  undo them; **reopen** clears the lock to recover from mistakes.
- Completing a turnover **auto-creates a payment due** (amount = the property's
  cleaning price) once per job.
- **Duplicate** reservations across feeds are flagged (`duplicateOf`) while
  preserving both source records.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **1** | Calendar sync + turnover dashboards | ✅ shipped |
| **1.5** | Checklists, photo proof, problem reports, inventory, invitations | ✅ shipped |
| **1.6** | Brand + dark mode + command palette + guided onboarding | ✅ shipped |
| **2** | Financials — manual payment tracking + expenses/receipts | ✅ shipped (Stripe automation later) |
| 3 | Payments automation (Stripe Connect, payouts, statements) | `PaymentMethod` ready to gain `STRIPE` |
| 4 | Linen service scheduling (pickup / wash / deliver) | `JobType` enum in schema |
| 5 | **Vendor marketplace + storefronts** — local linen & beach-gear rentals (bikes, chairs, umbrellas) hosts can book | `ServiceProviderProfile` modeled |
| 6 | Live ops (driving/arrived/cleaning status, ETA, SMS/push) | `JobStatusHistory` ready |
| 7 | Direct API integrations (Airbnb/Vrbo/Guesty/Hostaway/…) | provider abstraction in place |

Each later phase reuses the Phase 1 reservation/job core. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the deeper design and the
provider-extension guide.
