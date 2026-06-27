import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Notification fan-out. Phase 1 persists in-app notifications to the relevant
 * users (owner-org members + the assigned cleaner). Email/SMS/push fallback is
 * Phase 5 — wire additional transports here behind the same call sites.
 */

async function recipientsForProperty(propertyId: string): Promise<string[]> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      assignedCleanerUserId: true,
      assignedCleanerOrganizationId: true,
      ownerOrganization: { select: { members: { select: { userId: true } } } },
      assignedCleanerOrganization: { select: { members: { select: { userId: true } } } },
    },
  });
  if (!property) return [];

  const ids = new Set<string>();
  property.ownerOrganization?.members.forEach((m) => ids.add(m.userId));
  property.assignedCleanerOrganization?.members.forEach((m) => ids.add(m.userId));
  if (property.assignedCleanerUserId) ids.add(property.assignedCleanerUserId);
  return [...ids];
}

async function emit(
  propertyId: string,
  type: NotificationType,
  title: string,
  body: string | null,
  jobId?: string,
): Promise<void> {
  const userIds = await recipientsForProperty(propertyId);
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, body, jobId, propertyId })),
  });
}

export const notify = {
  jobCreated: (jobId: string, propertyId: string, sameDay: boolean) =>
    emit(
      propertyId,
      sameDay ? NotificationType.SAME_DAY_TURNOVER : NotificationType.JOB_CREATED,
      sameDay ? 'Same-day turnover scheduled' : 'New turnover job',
      sameDay
        ? 'A new guest checks in the same day as checkout. Tight window — plan ahead.'
        : 'A cleaning job was generated from a new reservation.',
      jobId,
    ),
  jobChanged: (jobId: string, propertyId: string, _sameDay: boolean) =>
    emit(
      propertyId,
      NotificationType.JOB_CHANGED,
      'Turnover job updated',
      'Reservation dates changed; the turnover job was updated.',
      jobId,
    ),
  jobCanceled: (jobId: string, propertyId: string) =>
    emit(
      propertyId,
      NotificationType.JOB_CANCELED,
      'Turnover job canceled',
      'The reservation was removed from the calendar feed.',
      jobId,
    ),
  jobCompleted: (jobId: string, propertyId: string) =>
    emit(
      propertyId,
      NotificationType.JOB_COMPLETED,
      'Turnover completed',
      'A cleaner marked the turnover complete.',
      jobId,
    ),
  jobProblem: (jobId: string, propertyId: string) =>
    emit(
      propertyId,
      NotificationType.JOB_CHANGED,
      'Turnover flagged: needs attention',
      'A cleaner flagged a problem on this turnover.',
      jobId,
    ),
};
