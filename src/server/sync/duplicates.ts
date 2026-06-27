import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Soft duplicate detection.
 *
 * When an owner connects both an Airbnb and a Vrbo feed (or re-lists), the same
 * stay can appear twice. We do NOT delete either record — we keep both source
 * rows for audit and flag the later-created one as `duplicateOf` the earlier.
 * Job generation can later choose to skip duplicates; for Phase 1 we surface the
 * flag in the UI and keep one job per reservation.
 *
 * Match heuristic: same property + identical checkout calendar instant +
 * check-in within 24h, from a DIFFERENT feed.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export async function detectDuplicateReservations(propertyId: string): Promise<number> {
  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: { in: [ReservationStatus.ACTIVE, ReservationStatus.CHANGED] },
    },
    orderBy: { createdAt: 'asc' },
  });

  let flagged = 0;
  for (let i = 0; i < reservations.length; i++) {
    const a = reservations[i];
    if (a.duplicateOfId) continue; // already a duplicate of something
    for (let j = i + 1; j < reservations.length; j++) {
      const b = reservations[j];
      if (b.calendarFeedId === a.calendarFeedId) continue; // same feed = not a cross-feed dupe
      if (b.duplicateOfId) continue;

      const sameCheckout =
        Math.abs(a.checkOutDate.getTime() - b.checkOutDate.getTime()) < DAY_MS;
      const closeCheckin =
        Math.abs(a.checkInDate.getTime() - b.checkInDate.getTime()) < DAY_MS;

      if (sameCheckout && closeCheckin) {
        await prisma.reservation.update({
          where: { id: b.id },
          data: { duplicateOfId: a.id },
        });
        flagged++;
      }
    }
  }
  return flagged;
}
