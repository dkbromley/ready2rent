# TurnReady

**Vacation rental turnovers, finally in sync.**
_From checkout to clean — without the texts._

TurnReady sits between rental booking platforms (Airbnb, Vrbo) and the people who
do the turnover work (cleaners, linen services). Owners connect their booking
calendars via iCal; TurnReady pulls reservations on a schedule and converts every
checkout into a scheduled cleaning job that cleaners see in real time.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Database | PostgreSQL (Supabase) via Prisma 6 |
| Auth | NextAuth / Auth.js v5 (credentials + JWT sessions) |
| Styling | Tailwind CSS 3 |
| Calendar parsing | `node-ical` |
| Background sync | Cron-based worker / Vercel Cron (`/api/cron/sync`) |

The sync layer is built behind a **provider abstraction** so direct APIs
(Airbnb/Vrbo/Guesty/Hostaway/…) can be added later without changing the
reservation/job model.

---

## Getting started

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
#   - DATABASE_URL / DIRECT_URL   (Supabase pooled + direct connection strings)
#   - AUTH_SECRET                 (openssl rand -base64 32)
#   - FEED_ENCRYPTION_KEY         (openssl rand -hex 32  -> 64 hex chars)
#   - CRON_SECRET                 (openssl rand -hex 32)

# 3. Create the schema
npm run db:push          # or: npm run db:migrate

# 4. Seed demo data (owner/cleaner/admin + a property with a same-day turnover)
npm run db:seed

# 5. Run
npm run dev              # http://localhost:3000
```

### Demo accounts (after seeding) — password `password123`

| Role | Email |
|---|---|
| Owner | `owner@turnready.app` |
| Cleaner | `cleaner@turnready.app` |
| Admin | `admin@turnready.app` |

### Recurring sync

- **Local / self-hosted:** `npm run sync:worker` (polls every 15 min).
- **Vercel:** `vercel.json` schedules `GET /api/cron/sync` every 15 min. Set
  `CRON_SECRET` so the endpoint is protected.
- **Manual:** owners can "Sync now" on a property; admins can sync any/all feeds
  from **Sync health**.

---

## Architecture

```
Booking platform (Airbnb/Vrbo)
        │  public iCal/ICS export URL
        ▼
ReservationProvider  ──►  ICalReservationProvider   (Phase 1)
   interface              AirbnbApiReservationProvider (Phase 6, later)
        │
        ▼
  Sync service  ── fetch → normalize → diff → persist → flag vanished → dedupe
        │
        ▼
 Turnover job generator  ── one job per reservation, same-day detection,
        │                    date-change propagation, cancel-on-removal
        ▼
   Dashboards (Owner / Cleaner / Admin)  +  Notifications
```

### Key directories

```
prisma/schema.prisma            Full data model (12+ entities)
src/server/providers/           Provider abstraction + ICalReservationProvider
src/server/sync/                sync-service, job-generator, duplicates, worker
src/server/queries.ts           Role-scoped read models for dashboards
src/server/actions.ts           Server actions (mutations)
src/lib/                        prisma, crypto (feed encryption), datetime, rbac, status
src/app/(auth)/                 Login / signup
src/app/(app)/                  Authenticated app (dashboards, properties, jobs, admin)
src/app/api/cron/sync/          Recurring sync endpoint
src/app/api/jobs/[id]/photos/   Completion photo upload
```

### Security model

- Calendar feed URLs are **encrypted at rest** (AES-256-GCM, `src/lib/crypto.ts`)
  and **never logged** (only the host appears in sync errors).
- We never ask for or store Airbnb/Vrbo credentials — iCal links only, no scraping.
- Role-based access control (`src/lib/rbac.ts`): owners see only their properties,
  cleaners only assigned jobs, admins see platform-wide sync health.
- Manual sync triggers are rate-limited with a per-feed cooldown.
- The cron endpoint is guarded by `CRON_SECRET`.

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

## Business rules (Phase 1)

- A reservation creates exactly **one** turnover job (keyed by reservation id → no
  duplicates on re-sync).
- The job is anchored to the **checkout** instant; the **next check-in** is the
  earliest other live reservation on the property.
- **Same-day turnover** (new guest checks in the same day) is flagged and
  visually highlighted everywhere.
- Reservation **date changes** propagate to the job unless it's already
  `COMPLETED`.
- A reservation that **vanishes** from the feed → `POSSIBLY_CANCELED`; its job is
  `CANCELED` (unless completed). **History is never auto-deleted.**
- **Duplicate** reservations across feeds are flagged (`duplicateOf`) while
  preserving both source records.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **1** | Calendar sync + cleaning dashboard | ✅ this codebase |
| 2 | Linen service scheduling (pickup / wash / deliver) | `JobType` enum already in schema |
| 3 | Marketplace (provider profiles, ratings, requests) | `ServiceProviderProfile` modeled |
| 4 | Payments (Stripe, payouts, invoices) | — |
| 5 | Live operations (driving/arrived/cleaning status, ETA, push) | `JobStatusHistory` ready |
| 6 | Direct API integrations (Airbnb/Vrbo/Guesty/Hostaway/…) | provider abstraction in place |

Each later phase reuses the Phase 1 reservation/job core. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the deeper design and the
provider-extension guide.
