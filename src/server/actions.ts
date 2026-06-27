'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CalendarPlatform, JobStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { encryptSecret, hashFeedUrl, normalizeFeedUrl } from '@/lib/crypto';
import {
  canAccessJob,
  canAccessProperty,
  getUserOrgIds,
  requireRole,
  requireUser,
} from '@/lib/rbac';
import { JOB_NEXT_STATUSES } from '@/lib/status';
import { syncFeed, syncAllActiveFeeds } from '@/server/sync/sync-service';
import { regeneratePropertyJobs } from '@/server/sync/job-generator';
import { notify } from '@/server/notifications';

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

const propertySchema = z.object({
  name: z.string().min(1).max(160),
  address: z.string().max(240).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  zip: z.string().max(20).optional(),
  bedrooms: z.coerce.number().int().min(0).max(50).default(0),
  bathrooms: z.coerce.number().int().min(0).max(50).default(0),
  timezone: z.string().min(1).default('America/New_York'),
  defaultCheckInTime: z.string().regex(/^\d{1,2}:\d{2}$/).default('16:00'),
  defaultCheckOutTime: z.string().regex(/^\d{1,2}:\d{2}$/).default('10:00'),
  notes: z.string().max(2000).optional(),
});

export async function createProperty(formData: FormData) {
  const user = await requireRole(UserRole.OWNER, UserRole.ADMIN);
  const parsed = propertySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid property');
  }

  // Pick the user's owner org (first membership) to attach the property.
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organization: { type: 'OWNER' } },
    select: { organizationId: true },
  });
  if (!membership) throw new Error('No owner organization found for this account.');

  const property = await prisma.property.create({
    data: { ...parsed.data, ownerOrganizationId: membership.organizationId },
  });

  revalidatePath('/properties');
  redirect(`/properties/${property.id}`);
}

// ---------------------------------------------------------------------------
// Calendar feeds
// ---------------------------------------------------------------------------

const feedSchema = z.object({
  propertyId: z.string().min(1),
  platform: z.nativeEnum(CalendarPlatform),
  feedUrl: z.string().url('Enter a valid URL'),
});

export async function addCalendarFeed(formData: FormData) {
  const user = await requireUser();
  const parsed = feedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid feed');
  }
  const { propertyId, platform, feedUrl } = parsed.data;

  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');

  const url = normalizeFeedUrl(feedUrl);
  if (!/^https?:\/\//i.test(url)) throw new Error('Feed URL must be http(s).');

  const feed = await prisma.calendarFeed.create({
    data: {
      propertyId,
      platform,
      feedUrlEncrypted: encryptSecret(url),
      feedUrlHash: hashFeedUrl(url),
    },
  });

  // Kick an immediate first sync so reservations + jobs appear right away.
  await syncFeed(feed.id).catch(() => undefined);

  revalidatePath(`/properties/${propertyId}`);
}

export async function removeCalendarFeed(feedId: string, propertyId: string) {
  const user = await requireUser();
  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');
  await prisma.calendarFeed.update({ where: { id: feedId }, data: { active: false } });
  revalidatePath(`/properties/${propertyId}`);
}

// ---------------------------------------------------------------------------
// Cleaner assignment
// ---------------------------------------------------------------------------

export async function assignCleaner(formData: FormData) {
  const user = await requireRole(UserRole.OWNER, UserRole.ADMIN);
  const propertyId = String(formData.get('propertyId') ?? '');
  const assignee = String(formData.get('assignee') ?? ''); // "org:<id>" | "user:<id>" | ""

  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');

  const data: { assignedCleanerOrganizationId: string | null; assignedCleanerUserId: string | null } =
    { assignedCleanerOrganizationId: null, assignedCleanerUserId: null };

  if (assignee.startsWith('org:')) data.assignedCleanerOrganizationId = assignee.slice(4);
  else if (assignee.startsWith('user:')) data.assignedCleanerUserId = assignee.slice(5);

  await prisma.property.update({ where: { id: propertyId }, data });

  // Apply the new assignment to existing non-terminal jobs.
  await prisma.turnoverJob.updateMany({
    where: {
      propertyId,
      status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELED] },
    },
    data,
  });

  // Notify the newly assigned cleaner of their queue.
  if (data.assignedCleanerUserId || data.assignedCleanerOrganizationId) {
    await notify.jobChanged('', propertyId, false).catch(() => undefined);
  }

  revalidatePath(`/properties/${propertyId}`);
}

// ---------------------------------------------------------------------------
// Job status & notes
// ---------------------------------------------------------------------------

export async function updateJobStatus(jobId: string, toStatus: JobStatus, note?: string) {
  const user = await requireUser();
  if (!(await canAccessJob(user, jobId))) throw new Error('Not authorized.');

  const job = await prisma.turnoverJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found.');

  // Enforce the allowed transition graph (admins may override).
  const allowed = JOB_NEXT_STATUSES[job.status];
  if (user.role !== UserRole.ADMIN && !allowed.includes(toStatus) && toStatus !== job.status) {
    throw new Error(`Cannot move from ${job.status} to ${toStatus}.`);
  }

  await prisma.turnoverJob.update({
    where: { id: jobId },
    data: {
      status: toStatus,
      completedAt: toStatus === JobStatus.COMPLETED ? new Date() : job.completedAt,
      statusHistory: {
        create: {
          fromStatus: job.status,
          toStatus,
          changedByUserId: user.id,
          note: note || null,
        },
      },
    },
  });

  if (toStatus === JobStatus.COMPLETED) await notify.jobCompleted(jobId, job.propertyId);
  else if (toStatus === JobStatus.PROBLEM) await notify.jobProblem(jobId, job.propertyId);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/cleaner');
  revalidatePath('/dashboard');
}

export async function saveJobNotes(formData: FormData) {
  const user = await requireUser();
  const jobId = String(formData.get('jobId') ?? '');
  if (!(await canAccessJob(user, jobId))) throw new Error('Not authorized.');

  const data: { ownerNotes?: string; cleanerNotes?: string } = {};
  if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
    data.ownerNotes = String(formData.get('ownerNotes') ?? '');
  }
  if (user.role === UserRole.CLEANER || user.role === UserRole.ADMIN) {
    const cleanerNotes = formData.get('cleanerNotes');
    if (cleanerNotes !== null) data.cleanerNotes = String(cleanerNotes);
  }

  await prisma.turnoverJob.update({ where: { id: jobId }, data });
  revalidatePath(`/jobs/${jobId}`);
}

// ---------------------------------------------------------------------------
// Sync triggers
// ---------------------------------------------------------------------------

const MANUAL_SYNC_COOLDOWN_MS = 20_000;

export async function triggerPropertySync(propertyId: string) {
  const user = await requireUser();
  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');

  const feeds = await prisma.calendarFeed.findMany({
    where: { propertyId, active: true },
    select: { id: true, lastSyncedAt: true },
  });
  for (const feed of feeds) {
    if (
      feed.lastSyncedAt &&
      Date.now() - feed.lastSyncedAt.getTime() < MANUAL_SYNC_COOLDOWN_MS
    ) {
      continue; // simple rate-limit guard against rapid manual triggers
    }
    await syncFeed(feed.id);
  }
  if (feeds.length === 0) await regeneratePropertyJobs(propertyId);

  revalidatePath(`/properties/${propertyId}`);
}

export async function triggerFeedSync(feedId: string) {
  await requireRole(UserRole.ADMIN);
  await syncFeed(feedId);
  revalidatePath('/admin/sync');
}

export async function triggerAllSync() {
  await requireRole(UserRole.ADMIN);
  await syncAllActiveFeeds();
  revalidatePath('/admin/sync');
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath('/notifications');
}
