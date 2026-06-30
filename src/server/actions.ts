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
import { notifyOwnerOfJob } from '@/server/owner-notify';
import { detectPlatformFromUrl } from '@/lib/feeds';
import { storePropertyImage, deleteStoredFile } from '@/lib/storage';
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/limits';

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
  calendarColor: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid color').optional(),
  ),
  cleaningPrice: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(100000).optional(),
  ),
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

  await handlePropertyImageUpload(property.id, formData);

  revalidatePath('/properties');
  redirect(`/properties/${property.id}`);
}

export async function updateProperty(propertyId: string, formData: FormData) {
  const user = await requireUser();
  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');
  const parsed = propertySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid property');
  }

  // Coalesce optional fields to explicit null so clearing them persists (Prisma
  // omits undefined). calendarColor/cleaningPrice are nullable on the model.
  const { calendarColor, cleaningPrice, ...rest } = parsed.data;
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      ...rest,
      calendarColor: calendarColor ?? null,
      cleaningPrice: cleaningPrice ?? null,
    },
  });

  revalidatePath('/properties');
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/cleaner/calendar');
  redirect(`/properties/${propertyId}`);
}

/** Reads an optional `image` File from a property form and stores it. No-op when absent/invalid. */
async function handlePropertyImageUpload(propertyId: string, formData: FormData): Promise<void> {
  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_IMAGE_BYTES) return;
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) return;
  const ext = file.name.split('.').pop() || 'jpg';
  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await storePropertyImage(propertyId, bytes, ext, file.type || 'image/jpeg').catch(() => null);
  if (stored) await prisma.property.update({ where: { id: propertyId }, data: { imageUrl: stored.url } });
}

/** Replace/remove a property's image after creation (called from the detail page). */
export async function setPropertyImageFromForm(formData: FormData) {
  const user = await requireUser();
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');
  const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { imageUrl: true } });
  await deleteStoredFile(prop?.imageUrl);
  await prisma.property.update({ where: { id: propertyId }, data: { imageUrl: null } });
  await handlePropertyImageUpload(propertyId, formData);
  revalidatePath(`/properties/${propertyId}`);
}

export async function removePropertyImage(propertyId: string) {
  const user = await requireUser();
  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');
  const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { imageUrl: true } });
  await deleteStoredFile(prop?.imageUrl);
  await prisma.property.update({ where: { id: propertyId }, data: { imageUrl: null } });
  revalidatePath(`/properties/${propertyId}`);
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

  // Owner-facing email (cleaner-led model): cleaning started / ready for arrival.
  if (toStatus === JobStatus.IN_PROGRESS) await notifyOwnerOfJob(jobId, 'started').catch(() => undefined);
  else if (toStatus === JobStatus.COMPLETED) await notifyOwnerOfJob(jobId, 'completed').catch(() => undefined);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/cleaner');
  revalidatePath('/dashboard');
}

/**
 * Manually mark a job complete from any state (host or cleaner). Sets the manual
 * lock so a later sync won't reopen or re-date it, and notifies as a completion.
 */
export async function manuallyCompleteJob(jobId: string, note?: string) {
  const user = await requireUser();
  if (!(await canAccessJob(user, jobId))) throw new Error('Not authorized.');
  const job = await prisma.turnoverJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found.');
  if (job.status === JobStatus.COMPLETED) return;

  await prisma.turnoverJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.COMPLETED,
      completedAt: new Date(),
      manualStatusLock: true,
      statusHistory: {
        create: {
          fromStatus: job.status,
          toStatus: JobStatus.COMPLETED,
          changedByUserId: user.id,
          note: note?.trim() || 'Marked complete manually',
        },
      },
    },
  });

  await notify.jobCompleted(jobId, job.propertyId).catch(() => undefined);
  await notifyOwnerOfJob(jobId, 'completed').catch(() => undefined);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/cleaner');
  revalidatePath('/dashboard');
}

/**
 * Cancel a scheduled job (host or cleaner). Locks it so the next sync won't
 * revive it while the reservation is still live. Completed jobs are left intact.
 */
export async function cancelJob(jobId: string, note?: string) {
  const user = await requireUser();
  if (!(await canAccessJob(user, jobId))) throw new Error('Not authorized.');
  const job = await prisma.turnoverJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found.');
  if (job.status === JobStatus.CANCELED || job.status === JobStatus.COMPLETED) return;

  await prisma.turnoverJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.CANCELED,
      manualStatusLock: true,
      statusHistory: {
        create: {
          fromStatus: job.status,
          toStatus: JobStatus.CANCELED,
          changedByUserId: user.id,
          note: note?.trim() || 'Canceled manually',
        },
      },
    },
  });

  await notify.jobCanceled(jobId, job.propertyId).catch(() => undefined);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/cleaner');
  revalidatePath('/dashboard');
}

export async function deleteJobPhoto(photoId: string) {
  const user = await requireUser();
  const photo = await prisma.jobPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return;
  if (!(await canAccessJob(user, photo.jobId))) throw new Error('Not authorized.');
  await deleteStoredFile(photo.url);
  await prisma.jobPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/jobs/${photo.jobId}`);
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
// Property checklists (host-authored, cleaner-completed)
// ---------------------------------------------------------------------------

const checklistTextSchema = z.string().trim().min(1, 'Add some text').max(280);

/** Host or assigned cleaner adds a checklist line. New items go to the bottom. */
export async function addChecklistItem(propertyId: string, formData: FormData) {
  const user = await requireUser();
  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');
  const parsed = checklistTextSchema.safeParse(formData.get('text'));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid item');

  const last = await prisma.propertyChecklistItem.findFirst({
    where: { propertyId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  await prisma.propertyChecklistItem.create({
    data: { propertyId, text: parsed.data, position: (last?.position ?? -1) + 1 },
  });
  revalidatePath(`/properties/${propertyId}`);
}

/** Host or assigned cleaner edits the text of a checklist item. */
export async function updateChecklistItem(itemId: string, formData: FormData) {
  const user = await requireUser();
  const item = await prisma.propertyChecklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Item not found.');
  if (!(await canAccessProperty(user, item.propertyId))) throw new Error('Not authorized.');
  const parsed = checklistTextSchema.safeParse(formData.get('text'));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid item');
  await prisma.propertyChecklistItem.update({ where: { id: itemId }, data: { text: parsed.data } });
  revalidatePath(`/properties/${item.propertyId}`);
}

/** Host or assigned cleaner deletes a checklist item. */
export async function deleteChecklistItem(itemId: string) {
  const user = await requireUser();
  const item = await prisma.propertyChecklistItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  if (!(await canAccessProperty(user, item.propertyId))) throw new Error('Not authorized.');
  await prisma.propertyChecklistItem.delete({ where: { id: itemId } });
  revalidatePath(`/properties/${item.propertyId}`);
}

/** Host or assigned cleaner reorders an item by swapping with its neighbor. */
export async function moveChecklistItem(itemId: string, dir: 'up' | 'down') {
  const user = await requireUser();
  const item = await prisma.propertyChecklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Item not found.');
  if (!(await canAccessProperty(user, item.propertyId))) throw new Error('Not authorized.');

  const neighbor = await prisma.propertyChecklistItem.findFirst({
    where: {
      propertyId: item.propertyId,
      position: dir === 'up' ? { lt: item.position } : { gt: item.position },
    },
    orderBy: { position: dir === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return; // already at the end

  await prisma.$transaction([
    prisma.propertyChecklistItem.update({ where: { id: item.id }, data: { position: neighbor.position } }),
    prisma.propertyChecklistItem.update({ where: { id: neighbor.id }, data: { position: item.position } }),
  ]);
  revalidatePath(`/properties/${item.propertyId}`);
}

/** Cleaner toggles a checklist item on a specific job (insert/delete the check). */
export async function toggleJobChecklistItem(jobId: string, itemId: string) {
  const user = await requireUser();
  if (!(await canAccessJob(user, jobId))) throw new Error('Not authorized.');

  const existing = await prisma.jobChecklistCheck.findUnique({
    where: { jobId_itemId: { jobId, itemId } },
  });
  if (existing) {
    await prisma.jobChecklistCheck.delete({ where: { id: existing.id } });
  } else {
    await prisma.jobChecklistCheck.create({
      data: { jobId, itemId, checkedByUserId: user.id },
    });
  }
  revalidatePath(`/jobs/${jobId}`);
}

// ---------------------------------------------------------------------------
// Problem reports
// ---------------------------------------------------------------------------

/**
 * Flag a job as a problem with a written description. Photos are uploaded
 * separately (kind=PROBLEM) via the photo endpoint. Notifies the host in-app and
 * by email (cleaner-led model).
 */
export async function reportJobProblem(formData: FormData) {
  const user = await requireUser();
  const jobId = String(formData.get('jobId') ?? '');
  if (!(await canAccessJob(user, jobId))) throw new Error('Not authorized.');
  const details = String(formData.get('details') ?? '').trim();

  const job = await prisma.turnoverJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found.');

  await prisma.turnoverJob.update({
    where: { id: jobId },
    data: {
      problemNote: details || null,
      // Don't override a terminal/completed job; otherwise mark PROBLEM.
      status: job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELED ? job.status : JobStatus.PROBLEM,
      statusHistory:
        job.status === JobStatus.PROBLEM
          ? undefined
          : { create: { fromStatus: job.status, toStatus: JobStatus.PROBLEM, changedByUserId: user.id, note: details || 'Problem reported' } },
    },
  });

  await notify.jobProblem(jobId, job.propertyId).catch(() => undefined);
  await notifyOwnerOfJob(jobId, 'problem').catch(() => undefined);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/cleaner');
  revalidatePath('/dashboard');
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

/** Save the current user's per-category notification opt-outs (checkbox form). */
export async function updateNotificationPreferences(formData: FormData) {
  const user = await requireUser();
  // Unchecked checkboxes are absent from the form → false.
  const on = (key: string) => formData.get(key) != null;
  const data = {
    newJobs: on('newJobs'),
    jobChanges: on('jobChanges'),
    jobCompleted: on('jobCompleted'),
    jobCanceled: on('jobCanceled'),
    sameDayTurnover: on('sameDayTurnover'),
    problems: on('problems'),
  };
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  revalidatePath('/settings/notifications');
}

// ---------------------------------------------------------------------------
// Cleaner-led onboarding: a cleaner adds a property from the owner's iCal link
// ---------------------------------------------------------------------------

const cleanerPropertySchema = z.object({
  name: z.string().min(1, 'Property name is required').max(160),
  feedUrl: z.string().url('Enter a valid iCal URL'),
  platform: z.string().optional(),
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
  ownerName: z.string().max(160).optional(),
  ownerEmail: z.string().email('Enter a valid owner email').optional().or(z.literal('')),
  ownerPhone: z.string().max(40).optional(),
  notifyByEmail: z.string().optional(), // checkbox "on"/undefined
});

export async function createCleanerProperty(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const parsed = cleanerPropertySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid property');
  }
  const d = parsed.data;

  // The cleaner's cleaning company org manages the record.
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organization: { type: 'CLEANING_COMPANY' } },
    select: { organizationId: true },
  });
  if (!membership) throw new Error('No cleaning organization found for this account.');

  const url = normalizeFeedUrl(d.feedUrl);
  if (!/^https?:\/\//i.test(url)) throw new Error('Feed URL must be http(s).');
  const platform =
    d.platform && d.platform in CalendarPlatform
      ? (d.platform as CalendarPlatform)
      : detectPlatformFromUrl(url);

  const property = await prisma.property.create({
    data: {
      name: d.name,
      address: d.address || null,
      city: d.city || null,
      state: d.state || null,
      zip: d.zip || null,
      bedrooms: d.bedrooms,
      bathrooms: d.bathrooms,
      timezone: d.timezone,
      defaultCheckInTime: d.defaultCheckInTime,
      defaultCheckOutTime: d.defaultCheckOutTime,
      notes: d.notes || null,
      ownerOrganizationId: membership.organizationId,
      managementMode: 'CLEANER_MANAGED',
      createdByUserId: user.id,
      // Auto-assign the creating cleaner so they (and only they) see the jobs.
      assignedCleanerOrganizationId: membership.organizationId,
      assignedCleanerUserId: user.id,
      // Owner contact for notifications (only if any detail provided).
      ...(d.ownerName || d.ownerEmail || d.ownerPhone
        ? {
            ownerContact: {
              create: {
                name: d.ownerName || null,
                email: d.ownerEmail || null,
                phone: d.ownerPhone || null,
                notifyByEmail: Boolean(d.notifyByEmail),
              },
            },
          }
        : {}),
      // The calendar feed itself.
      calendarFeeds: {
        create: {
          platform,
          feedUrlEncrypted: encryptSecret(url),
          feedUrlHash: hashFeedUrl(url),
        },
      },
    },
    include: { calendarFeeds: true },
  });

  // Immediate first sync so the schedule appears right away.
  await handlePropertyImageUpload(property.id, formData);

  const feed = property.calendarFeeds[0];
  if (feed) await syncFeed(feed.id).catch(() => undefined);

  revalidatePath('/cleaner/properties');
  revalidatePath('/cleaner');
  redirect(`/properties/${property.id}`);
}

export async function removeProperty(propertyId: string) {
  const user = await requireUser();
  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');
  // Soft-remove: deactivate property + feeds; cancel any open jobs so they stop
  // appearing in cleaner dashboards. Completed jobs are preserved for history.
  await prisma.property.update({ where: { id: propertyId }, data: { active: false } });
  await prisma.calendarFeed.updateMany({ where: { propertyId }, data: { active: false } });
  await prisma.turnoverJob.updateMany({
    where: {
      propertyId,
      status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELED] },
    },
    data: { status: JobStatus.CANCELED },
  });
  revalidatePath('/cleaner/properties');
  revalidatePath('/cleaner');
  revalidatePath('/properties');
}
