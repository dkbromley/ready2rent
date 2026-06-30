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

/**
 * Map each notification type to the user-preference flag that gates it. Types
 * absent here are never muted (e.g. direct assignment). A user with no
 * preference row receives everything (opt-out model).
 */
type PrefFlag = 'newJobs' | 'jobChanges' | 'jobCompleted' | 'jobCanceled' | 'sameDayTurnover' | 'problems';
const TYPE_TO_PREF: Partial<Record<NotificationType, PrefFlag>> = {
  JOB_CREATED: 'newJobs',
  SAME_DAY_TURNOVER: 'sameDayTurnover',
  JOB_CHANGED: 'jobChanges',
  RESERVATION_CHANGED: 'jobChanges',
  JOB_COMPLETED: 'jobCompleted',
  JOB_CANCELED: 'jobCanceled',
  RESERVATION_CANCELED: 'jobCanceled',
  JOB_PROBLEM: 'problems',
};

async function emit(
  propertyId: string,
  type: NotificationType,
  title: string,
  body: string | null,
  jobId?: string,
): Promise<void> {
  const userIds = await recipientsForProperty(propertyId);
  if (userIds.length === 0) return;

  // Drop recipients who muted this category. Missing prefs row = opted in.
  const prefFlag = TYPE_TO_PREF[type];
  let recipients = userIds;
  if (prefFlag) {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
    });
    const byUser = new Map(prefs.map((p) => [p.userId, p]));
    recipients = userIds.filter((uid) => byUser.get(uid)?.[prefFlag] ?? true);
  }
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({ userId, type, title, body, jobId, propertyId })),
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
      NotificationType.JOB_PROBLEM,
      'Turnover flagged: needs attention',
      'A cleaner flagged a problem on this turnover.',
      jobId,
    ),
  jobReopened: (jobId: string, propertyId: string) =>
    emit(
      propertyId,
      NotificationType.JOB_CHANGED,
      'Turnover reopened',
      'A completed/canceled turnover was reopened and is active again.',
      jobId,
    ),
};
