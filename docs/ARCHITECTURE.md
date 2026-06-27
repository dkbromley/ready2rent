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

## 8. Phase roadmap detail

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
