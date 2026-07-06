import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/server/email';

/**
 * Notification fan-out. Persists in-app notifications to the relevant users
 * (owner-org members + the assigned cleaner), and additionally emails the
 * urgent categories (same-day turnovers, problems, direct assignment) to
 * users who opted in via NotificationPreference.emailAlerts. SMS/push are
 * still future transports — wire them here behind the same call sites.
 */

/** Categories urgent enough to leave the app. Everything else is in-app only. */
const EMAIL_TYPES = new Set<NotificationType>([
  NotificationType.SAME_DAY_TURNOVER,
  NotificationType.JOB_PROBLEM,
  NotificationType.ASSIGNMENT,
]);

function appBase(): string {
  return process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://ready2rent.io';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimal branded email around the same title/body as the in-app row. */
function alertHtml(title: string, body: string | null, jobId?: string): string {
  const base = appBase();
  const jobUrl = jobId ? `${base}/jobs/${jobId}` : `${base}/notifications`;
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1d2748">
    <div style="padding:20px 0">
      <span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#1d2748">Ready<span style="color:#0d9488">2</span>Rent</span>
    </div>
    <p style="font-size:16px;font-weight:700;margin:0 0 8px">${escapeHtml(title)}</p>
    ${body ? `<p style="font-size:14px;line-height:1.5;color:#526dac;margin:0">${escapeHtml(body)}</p>` : ''}
    <div style="padding:20px 0">
      <a href="${jobUrl}" style="background:#0d9488;color:#fff;text-decoration:none;padding:11px 18px;border-radius:12px;font-weight:600;font-size:14px">${jobId ? 'Open the job' : 'Open Ready2Rent'}</a>
    </div>
    <p style="font-size:12px;color:#85a3ca;line-height:1.5">
      You get urgent alerts by email because you turned them on.
      <a href="${base}/settings/notifications" style="color:#0d9488">Manage notification settings</a>
    </p>
  </div>`;
}

/** Persist in-app rows for `userIds`, then email the urgent categories to
 * those who opted in (opt-in: no preference row = email off). */
async function deliver(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string | null,
  jobId?: string,
  propertyId?: string,
): Promise<void> {
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, body, jobId, propertyId })),
  });

  if (!EMAIL_TYPES.has(type)) return;
  const optedIn = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, emailAlerts: true },
    select: { user: { select: { email: true } } },
  });
  // sendEmail never throws (it records FAILED/SKIPPED in MessageLog), but
  // settle defensively — a transport hiccup must not fail the caller's action.
  await Promise.allSettled(
    optedIn.map((p) =>
      sendEmail({
        to: p.user.email,
        subject: title,
        html: alertHtml(title, body, jobId),
        type: `teammate_${type.toLowerCase()}`,
        propertyId,
        jobId,
      }),
    ),
  );
}

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
  await deliver(recipients, type, title, body, jobId, propertyId);
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
  /** Straight to the assignee — never muted (absent from TYPE_TO_PREF). */
  jobAssigned: (jobId: string, propertyId: string, assigneeUserId: string, propertyName: string) =>
    deliver(
      [assigneeUserId],
      NotificationType.ASSIGNMENT,
      'Turnover assigned to you',
      `${propertyName} was handed to you — it's on your schedule.`,
      jobId,
      propertyId,
    ),
};
