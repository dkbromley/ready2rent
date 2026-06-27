# TurnReady — Architecture & Design

This document covers the product architecture, data model, and the extension
points that keep later phases from disturbing the Phase 1 core.

## 1. Product overview

TurnReady is an **operations layer**, not a PMS and not a booking channel. It
ingests reservations from the channels owners already use and turns them into
**turnover work** for cleaners and (Phase 2) linen providers.

Three roles in Phase 1:

- **Property Owner** — adds properties, connects calendars, assigns cleaners,
  watches status.
- **Cleaner** — sees assigned turnovers, updates status, uploads photos.
- **Admin** — monitors sync health, re-runs syncs, sees platform-wide data.

## 2. The provider abstraction (why Phase 6 is cheap)

Everything reservation-related flows through one interface
(`src/server/providers/types.ts`):

```ts
interface ReservationProvider {
  fetchReservations(property, feed): Promise<{ reservations: NormalizedReservation[] }>
  detectChanges(existing, incoming): ChangeResult
}
```

- Phase 1 ships **`ICalReservationProvider`**. The registry
  (`src/server/providers/index.ts`) maps every `CalendarPlatform` to it.
- Phase 6 adds `AirbnbApiReservationProvider`, `VrboApiReservationProvider`,
  `GuestyProvider`, `HostawayProvider`, `OwnerRezProvider`,
  `HospitableProvider`, `LodgifyProvider` — each implements the same interface
  and registers by platform. **The sync service and job generator never change.**

The canonical identity is `(sourcePlatform, externalUid)`. For iCal that's the
VEVENT `UID`; for an API it's the reservation id. Change detection and dedupe key
off this, so switching a feed from iCal to API later is a provider swap, not a
data migration.

## 3. Sync pipeline

`src/server/sync/sync-service.ts` per feed:

1. **Decrypt** the feed URL (AES-256-GCM).
2. **Fetch + normalize** via the provider (timeout, size cap, content sniff).
3. **Diff** each incoming reservation against the stored snapshot:
   - unseen UID → create (`ACTIVE`)
   - seen UID, fields differ → update (`CHANGED`)
   - seen UID, identical → touch `lastSeenAt`
4. **Flag vanished** stored reservations not present this fetch →
   `POSSIBLY_CANCELED` (never deleted).
5. **Dedupe** across the property's feeds (`duplicateOf`, both rows kept).
6. **Regenerate jobs** for the whole property (next-check-in is global).
7. **Record** `SyncLog` + update `CalendarFeed.lastSync*`. Failures are caught and
   surfaced on the admin Sync Health page; URLs are never logged.

Failure handling is per-feed isolated — one bad feed never blocks the batch.

### Swapping the runner

Phase 1 uses a cron-based runner (`/api/cron/sync` + `vercel.json`, or
`npm run sync:worker`). To move to **Inngest / Trigger.dev / BullMQ**, replace the
batch call in the cron route/worker with per-feed job enqueues that each call
`syncFeed(feedId)`. The service is already idempotent and per-feed.

## 4. Job generation rules

`src/server/sync/job-generator.ts`, run at property scope:

- One `TurnoverJob` per reservation (unique `reservationId`).
- Anchored to `checkoutDateTime`. `nextCheckInDateTime` = earliest live check-in
  `>= checkout`. From it: `turnoverWindowMinutes` and `sameDayTurnover` (same
  local calendar day in the property timezone).
- Date changes propagate **unless** the job is `COMPLETED`.
- Reservation goes (possibly) canceled → job `CANCELED` unless `COMPLETED`.
- A reappearing reservation reopens a previously canceled job.
- Every transition writes `JobStatusHistory`. Notifications fan out to owner-org
  members + the assigned cleaner.

## 5. Time handling

iCal all-day events carry no time. The property's `timezone` +
`defaultCheckOutTime` / `defaultCheckInTime` resolve all-day boundaries into
absolute instants (`src/lib/datetime.ts`, via `date-fns-tz`). Stored instants are
UTC; display re-zones to the property timezone. Same-day detection compares local
day keys, so a 11pm-checkout / 1am-checkin pair is judged in the property's wall
clock, not the server's.

## 6. Data model

See `prisma/schema.prisma`. Entities:

`User`, `Organization`, `OrganizationMember`, `Property`, `CalendarFeed`,
`Reservation`, `TurnoverJob`, `JobStatusHistory`, `JobPhoto`, `Notification`,
`SyncLog`, `ServiceProviderProfile`.

Forward hooks already in the schema:

- `JobType` (`TURNOVER | LINEN_PICKUP | LINEN_WASH | LINEN_DELIVERY`) — Phase 2
  linen tasks reuse the job/status/photo machinery.
- `Property.linenProviderOrganizationId` — Phase 2 linen assignment.
- `ServiceProviderProfile` (service areas, base price, ratings) — Phase 3
  marketplace.
- `Reservation.rawPayload` + provider identity — Phase 6 API ingestion + audit.

## 7. Security

- **Feed URLs** encrypted at rest, hashed (`feedUrlHash`) for dedupe without
  decryption, redacted to host on logging.
- **No credentials, no scraping** — public iCal only in Phase 1.
- **RBAC** in `src/lib/rbac.ts`: `canAccessProperty` / `canAccessJob` scope every
  read and mutation. Owners ↔ their org's properties; cleaners ↔ assigned work;
  admins ↔ everything.
- **Rate limiting** on manual sync (per-feed cooldown); cron endpoint behind
  `CRON_SECRET`.
- Job status transitions are validated against an allowed-transition graph
  (`JOB_NEXT_STATUSES`).

## 8. Performance & infrastructure

Hosting: Next.js on Netlify Functions (**us-east-2**); Postgres on Supabase
(**us-east-1**, co-located). Lessons from profiling the dashboard (which started
at ~4.4s and is now ~0.4s warm):

- **`connection_limit` must be > 1.** On the pooled (pgbouncer transaction-mode)
  connection, `connection_limit=1` forces every `Promise.all` query to serialize
  over a single connection. We use `connection_limit=8` so dashboard queries run
  concurrently. The pooler is built for many client connections, so this is safe.
- **Scope by relation, not a pre-fetched id list.** `getOwnerDashboard` filters
  every query by `property → org membership` (`ownerPropertyScope`) instead of
  first fetching property ids and passing `{ in: [...] }`. That removes a serial
  round trip so the whole dashboard is one parallel batch.
- **Co-locate DB and functions.** A cross-region hop (us-west-2 ↔ us-east-2) cost
  ~260ms *per query*; same-region (~us-east-1 ↔ us-east-2) is ~70ms. This was the
  single biggest win. Region can't be changed in place — migrate with
  `scripts/migrate-region.ts` (copies data + storage between two projects).
- **Perceived performance.** `loading.tsx` boundaries render an instant skeleton
  + progress bar on every navigation (`components/Skeletons.tsx`); `SubmitButton`
  (`useFormStatus`) gives server-action forms an immediate spinner;
  `experimental.staleTimes` keeps a short client router cache so revisiting a tab
  is instant. Mutations call `revalidatePath`, which busts that cache.

Operational scripts: `npm run harden:rls` (enable RLS on all tables),
`npm run setup:storage` (create the photos bucket), `npm run migrate:region`
(cross-project data + storage move).

## 9. Phase roadmap detail

- **Phase 2 — Linen:** add a `LinenTask`/child-job relation off `TurnoverJob`
  (or emit `JobType.LINEN_*` jobs), a linen-provider dashboard, and pickup/deliver
  scheduling. Assignment already modeled on `Property`.
- **Phase 3 — Marketplace:** flesh out `ServiceProviderProfile`, add requests /
  offers / availability and ratings.
- **Phase 4 — Payments:** Stripe Connect, job pricing, platform fee, payouts,
  invoices. Add `Payment`/`Invoice` models keyed to jobs.
- **Phase 5 — Live ops:** live cleaner status (driving/arrived/cleaning/finished)
  on top of `JobStatusHistory`, ETA, push + SMS/email fallback, escalation.
- **Phase 6 — APIs:** implement the additional providers behind the existing
  interface; migrate feeds platform-by-platform with zero schema change.
