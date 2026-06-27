import { Prisma, ReservationStatus, SyncStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret, redactUrlForLog } from '@/lib/crypto';
import { getProvider } from '@/server/providers';
import type { NormalizedReservation } from '@/server/providers/types';
import { regeneratePropertyJobs } from './job-generator';
import { detectDuplicateReservations } from './duplicates';

export interface FeedSyncResult {
  feedId: string;
  status: SyncStatus;
  reservationsFound: number;
  created: number;
  updated: number;
  canceled: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsCanceled: number;
  error?: string;
}

/**
 * Sync a single calendar feed:
 *   fetch -> normalize -> diff against stored -> persist -> flag vanished
 *   -> dedupe -> (re)generate turnover jobs -> write SyncLog.
 *
 * Failures are caught and recorded; the feed's lastSyncStatus/lastSyncError are
 * updated so the admin sync-health page surfaces them. Feed URLs are never logged.
 */
export async function syncFeed(feedId: string): Promise<FeedSyncResult> {
  const startedAt = Date.now();
  const result: FeedSyncResult = {
    feedId,
    status: SyncStatus.RUNNING,
    reservationsFound: 0,
    created: 0,
    updated: 0,
    canceled: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsCanceled: 0,
  };

  const feed = await prisma.calendarFeed.findUnique({
    where: { id: feedId },
    include: {
      property: {
        select: {
          id: true,
          timezone: true,
          defaultCheckInTime: true,
          defaultCheckOutTime: true,
        },
      },
    },
  });

  if (!feed) {
    result.status = SyncStatus.FAILED;
    result.error = 'Feed not found';
    return result;
  }

  let url: string;
  try {
    url = decryptSecret(feed.feedUrlEncrypted);
  } catch {
    return finalizeFailure(feed.id, feed.propertyId, result, startedAt, 'Could not decrypt feed URL');
  }

  const provider = getProvider(feed.platform);

  let incoming: NormalizedReservation[];
  try {
    const fetched = await provider.fetchReservations(
      {
        id: feed.property.id,
        timezone: feed.property.timezone,
        defaultCheckInTime: feed.property.defaultCheckInTime,
        defaultCheckOutTime: feed.property.defaultCheckOutTime,
      },
      { id: feed.id, platform: feed.platform, url },
    );
    incoming = fetched.reservations;
  } catch (err) {
    const safe = `${err instanceof Error ? err.message : 'Fetch failed'} (host: ${redactUrlForLog(url)})`;
    return finalizeFailure(feed.id, feed.propertyId, result, startedAt, safe);
  }

  result.reservationsFound = incoming.length;

  // Index existing reservations for this feed by externalUid.
  const existingList = await prisma.reservation.findMany({
    where: { calendarFeedId: feed.id },
  });
  const existingByUid = new Map(existingList.map((r) => [r.externalUid, r]));
  const seenUids = new Set<string>();

  for (const inc of incoming) {
    seenUids.add(inc.externalUid);
    const existing = existingByUid.get(inc.externalUid);

    // Richer fields, shared by create + update. Null for iCal-only feeds; set by
    // API providers. undefined is omitted by Prisma, so we coalesce to null.
    const richFields = {
      guestName: inc.guestName ?? null,
      guestCount: inc.guestCount ?? null,
      confirmationCode: inc.confirmationCode ?? null,
      guestPhoneLast4: inc.guestPhoneLast4 ?? null,
      reservationUrl: inc.reservationUrl ?? null,
      hasExactTimes: inc.hasExactTimes ?? false,
    };

    if (!existing) {
      await prisma.reservation.create({
        data: {
          propertyId: feed.propertyId,
          calendarFeedId: feed.id,
          externalUid: inc.externalUid,
          sourcePlatform: inc.sourcePlatform,
          summary: inc.summary,
          checkInDate: inc.checkInDate,
          checkOutDate: inc.checkOutDate,
          rawStart: inc.rawStart,
          rawEnd: inc.rawEnd,
          // Provider may explicitly signal a cancellation (APIs); iCal never does.
          status: inc.isCanceled ? ReservationStatus.CANCELED : ReservationStatus.ACTIVE,
          lastSeenAt: new Date(),
          rawPayload: (inc.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined,
          ...richFields,
        },
      });
      result.created++;
      continue;
    }

    const { changed } = provider.detectChanges(
      {
        checkInDate: existing.checkInDate,
        checkOutDate: existing.checkOutDate,
        summary: existing.summary,
        guestCount: existing.guestCount,
        confirmationCode: existing.confirmationCode,
      },
      inc,
    );

    await prisma.reservation.update({
      where: { id: existing.id },
      data: {
        summary: inc.summary,
        checkInDate: inc.checkInDate,
        checkOutDate: inc.checkOutDate,
        rawStart: inc.rawStart,
        rawEnd: inc.rawEnd,
        rawPayload: (inc.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined,
        lastSeenAt: new Date(),
        ...richFields,
        // Explicit cancellation wins; otherwise changed -> CHANGED, else ACTIVE.
        status: inc.isCanceled
          ? ReservationStatus.CANCELED
          : changed
            ? ReservationStatus.CHANGED
            : ReservationStatus.ACTIVE,
      },
    });
    if (changed) result.updated++;
  }

  // Reservations previously stored but missing from this fetch = possibly canceled.
  const vanished = existingList.filter(
    (r) =>
      !seenUids.has(r.externalUid) &&
      r.status !== ReservationStatus.POSSIBLY_CANCELED &&
      r.status !== ReservationStatus.CANCELED,
  );
  if (vanished.length > 0) {
    await prisma.reservation.updateMany({
      where: { id: { in: vanished.map((r) => r.id) } },
      data: { status: ReservationStatus.POSSIBLY_CANCELED },
    });
    result.canceled += vanished.length;
  }

  // Soft duplicate detection across all of the property's feeds.
  await detectDuplicateReservations(feed.propertyId);

  // Regenerate turnover jobs for the whole property (next-check-in is global).
  const jobSummary = await regeneratePropertyJobs(feed.propertyId);
  result.jobsCreated = jobSummary.jobsCreated;
  result.jobsUpdated = jobSummary.jobsUpdated;
  result.jobsCanceled = jobSummary.jobsCanceled;

  result.status = SyncStatus.SUCCESS;

  const durationMs = Date.now() - startedAt;
  await prisma.$transaction([
    prisma.calendarFeed.update({
      where: { id: feed.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: SyncStatus.SUCCESS,
        lastSyncError: null,
      },
    }),
    prisma.syncLog.create({
      data: {
        calendarFeedId: feed.id,
        propertyId: feed.propertyId,
        status: SyncStatus.SUCCESS,
        message: `Synced ${result.reservationsFound} reservations`,
        reservationsFound: result.reservationsFound,
        created: result.created,
        updated: result.updated,
        canceled: result.canceled,
        jobsCreated: result.jobsCreated,
        jobsUpdated: result.jobsUpdated,
        durationMs,
        finishedAt: new Date(),
      },
    }),
  ]);

  return result;
}

/** Sync every active feed (cron entry point). Isolated per-feed error handling. */
export async function syncAllActiveFeeds(): Promise<FeedSyncResult[]> {
  const feeds = await prisma.calendarFeed.findMany({
    where: { active: true, property: { active: true } },
    select: { id: true },
  });

  const results: FeedSyncResult[] = [];
  for (const feed of feeds) {
    try {
      results.push(await syncFeed(feed.id));
    } catch (err) {
      results.push({
        feedId: feed.id,
        status: SyncStatus.FAILED,
        reservationsFound: 0,
        created: 0,
        updated: 0,
        canceled: 0,
        jobsCreated: 0,
        jobsUpdated: 0,
        jobsCanceled: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
  return results;
}

async function finalizeFailure(
  feedId: string,
  propertyId: string,
  result: FeedSyncResult,
  startedAt: number,
  errorDetail: string,
): Promise<FeedSyncResult> {
  result.status = SyncStatus.FAILED;
  result.error = errorDetail;
  await prisma.$transaction([
    prisma.calendarFeed.update({
      where: { id: feedId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: SyncStatus.FAILED,
        lastSyncError: errorDetail,
      },
    }),
    prisma.syncLog.create({
      data: {
        calendarFeedId: feedId,
        propertyId,
        status: SyncStatus.FAILED,
        message: 'Sync failed',
        errorDetail,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      },
    }),
  ]);
  return result;
}
