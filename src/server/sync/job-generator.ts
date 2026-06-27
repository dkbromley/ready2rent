import { JobStatus, Prisma, ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { diffMinutes, isSameLocalDay } from '@/lib/datetime';
import { notify } from '@/server/notifications';

export interface JobGenSummary {
  jobsCreated: number;
  jobsUpdated: number;
  jobsCanceled: number;
}

/**
 * Turnover job generation rules (Phase 1):
 *  - Every live reservation (ACTIVE | CHANGED) gets exactly one TURNOVER job,
 *    keyed by reservationId (unique) so re-running sync never duplicates.
 *  - The job is anchored to the reservation's checkout instant.
 *  - The "next check-in" is the earliest other live reservation on the same
 *    property whose check-in is >= this checkout. From it we derive the turnover
 *    window and the same-day-turnover flag.
 *  - Date changes propagate to the job UNLESS the job is already COMPLETED.
 *  - When a reservation goes (POSSIBLY_)CANCELED, its job is CANCELED unless
 *    already COMPLETED (history is preserved either way).
 *
 * Runs at the property level so "next check-in" is always computed against the
 * full, current picture across all of the property's feeds.
 */
export async function regeneratePropertyJobs(propertyId: string): Promise<JobGenSummary> {
  const summary: JobGenSummary = { jobsCreated: 0, jobsUpdated: 0, jobsCanceled: 0 };

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      timezone: true,
      assignedCleanerOrganizationId: true,
      assignedCleanerUserId: true,
      ownerOrganizationId: true,
    },
  });
  if (!property) return summary;

  const reservations = await prisma.reservation.findMany({
    where: { propertyId },
    include: { turnoverJob: true },
    orderBy: { checkOutDate: 'asc' },
  });

  const live = reservations.filter(
    (r) => r.status === ReservationStatus.ACTIVE || r.status === ReservationStatus.CHANGED,
  );

  // Pre-sort live check-ins to resolve "next check-in" efficiently.
  const liveCheckIns = live
    .map((r) => r.checkInDate)
    .sort((a, b) => a.getTime() - b.getTime());

  for (const reservation of live) {
    const nextCheckIn = findNextCheckIn(reservation.checkOutDate, liveCheckIns);
    const sameDay = nextCheckIn
      ? isSameLocalDay(reservation.checkOutDate, nextCheckIn, property.timezone)
      : false;
    const windowMinutes = nextCheckIn
      ? diffMinutes(reservation.checkOutDate, nextCheckIn)
      : null;

    const existing = reservation.turnoverJob;

    if (!existing) {
      const job = await prisma.turnoverJob.create({
        data: {
          propertyId,
          reservationId: reservation.id,
          assignedOrganizationId: property.assignedCleanerOrganizationId,
          assignedUserId: property.assignedCleanerUserId,
          checkoutDateTime: reservation.checkOutDate,
          nextCheckInDateTime: nextCheckIn,
          sameDayTurnover: sameDay,
          turnoverWindowMinutes: windowMinutes,
          status: JobStatus.NEEDS_SCHEDULING,
          statusHistory: {
            create: { toStatus: JobStatus.NEEDS_SCHEDULING, note: 'Auto-created from reservation' },
          },
        },
      });
      summary.jobsCreated++;
      await notify.jobCreated(job.id, propertyId, sameDay);
      continue;
    }

    // Completed jobs are immutable to date changes — preserve the record of work.
    if (existing.status === JobStatus.COMPLETED) continue;

    const needsUpdate =
      existing.checkoutDateTime.getTime() !== reservation.checkOutDate.getTime() ||
      (existing.nextCheckInDateTime?.getTime() ?? null) !== (nextCheckIn?.getTime() ?? null) ||
      existing.sameDayTurnover !== sameDay ||
      existing.turnoverWindowMinutes !== windowMinutes ||
      existing.status === JobStatus.CANCELED; // reservation came back to life

    if (needsUpdate) {
      const revived = existing.status === JobStatus.CANCELED;
      await prisma.turnoverJob.update({
        where: { id: existing.id },
        data: {
          checkoutDateTime: reservation.checkOutDate,
          nextCheckInDateTime: nextCheckIn,
          sameDayTurnover: sameDay,
          turnoverWindowMinutes: windowMinutes,
          ...(revived ? { status: JobStatus.NEEDS_SCHEDULING } : {}),
          statusHistory: {
            create: {
              fromStatus: existing.status,
              toStatus: revived ? JobStatus.NEEDS_SCHEDULING : existing.status,
              note: revived ? 'Reservation reappeared; job reopened' : 'Reservation dates changed',
            },
          },
        },
      });
      summary.jobsUpdated++;
      await notify.jobChanged(existing.id, propertyId, sameDay);
    }
  }

  // Cancel jobs whose reservations are no longer live (unless already completed).
  const dead = reservations.filter(
    (r) =>
      (r.status === ReservationStatus.CANCELED ||
        r.status === ReservationStatus.POSSIBLY_CANCELED) &&
      r.turnoverJob &&
      r.turnoverJob.status !== JobStatus.COMPLETED &&
      r.turnoverJob.status !== JobStatus.CANCELED,
  );

  for (const r of dead) {
    const job = r.turnoverJob!;
    await prisma.turnoverJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.CANCELED,
        statusHistory: {
          create: {
            fromStatus: job.status,
            toStatus: JobStatus.CANCELED,
            note: 'Reservation removed/canceled from calendar feed',
          },
        },
      },
    });
    summary.jobsCanceled++;
    await notify.jobCanceled(job.id, propertyId);
  }

  return summary;
}

/** Earliest check-in strictly at/after the checkout instant. */
function findNextCheckIn(checkout: Date, sortedCheckIns: Date[]): Date | null {
  for (const ci of sortedCheckIns) {
    // A reservation's own check-in precedes its checkout, so >= checkout safely
    // excludes self and finds the *next* guest.
    if (ci.getTime() >= checkout.getTime()) return ci;
  }
  return null;
}

export type { Prisma };
