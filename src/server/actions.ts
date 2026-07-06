'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CalendarPlatform, ExpenseCategory, JobStatus, JobType, MemberRole, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { encryptSecret, encryptOptional, hashFeedUrl, normalizeFeedUrl } from '@/lib/crypto';
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
import { applyInvitationAcceptance, sendInvitationEmail } from '@/server/invitations';
import { detectPlatformFromUrl } from '@/lib/feeds';
import { resolveLocalDateTime, isValidTimezone } from '@/lib/datetime';
import { storePropertyImage, storeReceipt, deleteStoredFile, deleteReceipt } from '@/lib/storage';
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
  unitNumber: z.string().max(40).optional(),
  mainDoorAccess: z.string().max(300).optional(),
  ownerClosetAccess: z.string().max(300).optional(),
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

  // Door/closet codes are encrypted at rest (same treatment as feed URLs).
  const { mainDoorAccess, ownerClosetAccess, ...rest } = parsed.data;
  const property = await prisma.property.create({
    data: {
      ...rest,
      ownerOrganizationId: membership.organizationId,
      mainDoorAccess: encryptOptional(mainDoorAccess),
      ownerClosetAccess: encryptOptional(ownerClosetAccess),
    },
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
  const { calendarColor, cleaningPrice, unitNumber, mainDoorAccess, ownerClosetAccess, ...rest } = parsed.data;
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      ...rest,
      calendarColor: calendarColor ?? null,
      cleaningPrice: cleaningPrice ?? null,
      unitNumber: unitNumber?.trim() || null,
      mainDoorAccess: encryptOptional(mainDoorAccess),
      ownerClosetAccess: encryptOptional(ownerClosetAccess),
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
// Invitations (host <-> cleaner)
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email'),
  invitedRole: z.enum(['OWNER', 'CLEANER']),
  propertyId: z.string().optional(),
});

/** Invite a cleaner (or host) by email, optionally linking them to a property. */
export async function createInvitation(formData: FormData) {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    invitedRole: formData.get('invitedRole'),
    propertyId: formData.get('propertyId') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid invitation');
  const { email, invitedRole, propertyId } = parsed.data;

  if (propertyId && !(await canAccessProperty(user, propertyId))) {
    throw new Error('Not authorized.');
  }

  // Record-keeping: tie the invite to the inviter's first org.
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
  });

  // Avoid stacking duplicate pending invites for the same email+property.
  const dupe = await prisma.invitation.findFirst({
    where: { email: email.toLowerCase(), propertyId: propertyId ?? null, status: 'PENDING' },
  });
  if (dupe) {
    await sendInvitationEmail(dupe.id);
  } else {
    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase(),
        invitedRole: invitedRole as UserRole,
        invitedByUserId: user.id,
        organizationId: membership?.organizationId ?? null,
        propertyId: propertyId ?? null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
    await sendInvitationEmail(invitation.id);
  }

  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

export async function revokeInvitation(invitationId: string) {
  const user = await requireUser();
  const inv = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!inv) return;
  // Only the inviter (or someone who can access the linked property) may revoke.
  const allowed =
    inv.invitedByUserId === user.id ||
    (inv.propertyId ? await canAccessProperty(user, inv.propertyId) : false);
  if (!allowed) throw new Error('Not authorized.');
  await prisma.invitation.update({ where: { id: invitationId }, data: { status: 'REVOKED' } });
  if (inv.propertyId) revalidatePath(`/properties/${inv.propertyId}`);
}

/** Accept an invitation as the currently signed-in user. */
export async function acceptInvitation(token: string) {
  const user = await requireUser();
  const result = await applyInvitationAcceptance(token, user.id);
  if (!result.ok) throw new Error(result.error ?? 'Could not accept invitation.');
  revalidatePath('/dashboard');
  if (result.propertyId) {
    revalidatePath(`/properties/${result.propertyId}`);
    redirect(`/properties/${result.propertyId}`);
  }
  redirect('/dashboard');
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

  // A completed clean auto-creates a cleaning payment due (host → cleaner).
  if (toStatus === JobStatus.COMPLETED) await ensurePaymentForJob(jobId).catch(() => undefined);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/cleaner');
  revalidatePath('/dashboard');
  revalidatePath('/financials');
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
  await ensurePaymentForJob(jobId).catch(() => undefined);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/cleaner');
  revalidatePath('/dashboard');
  revalidatePath('/financials');
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

/**
 * Reopen a job that was completed or canceled by mistake. Restores it to the
 * status it held immediately before the terminal change (falling back to
 * SCHEDULED when a cleaner is assigned, else NEEDS_SCHEDULING) and clears the
 * manual lock + completedAt so the next calendar sync resumes managing it.
 */
export async function reopenJob(jobId: string, note?: string) {
  const user = await requireUser();
  if (!(await canAccessJob(user, jobId))) throw new Error('Not authorized.');
  const job = await prisma.turnoverJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found.');
  if (job.status !== JobStatus.COMPLETED && job.status !== JobStatus.CANCELED) return;

  // The last history row's fromStatus is where the job was just before it was
  // completed/canceled — the natural "undo" target.
  const lastChange = await prisma.jobStatusHistory.findFirst({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  });
  const prior = lastChange?.fromStatus ?? null;
  const isTerminal = (s: JobStatus | null) =>
    s === JobStatus.COMPLETED || s === JobStatus.CANCELED || s == null;
  const restoreTo = !isTerminal(prior)
    ? (prior as JobStatus)
    : job.assignedUserId
      ? JobStatus.SCHEDULED
      : JobStatus.NEEDS_SCHEDULING;

  await prisma.turnoverJob.update({
    where: { id: jobId },
    data: {
      status: restoreTo,
      manualStatusLock: false,
      completedAt: null,
      // Ensure a reopened job reappears on dashboards even if the cleanup cron
      // had already archived an old completed job.
      archivedAt: null,
      statusHistory: {
        create: {
          fromStatus: job.status,
          toStatus: restoreTo,
          changedByUserId: user.id,
          note: note?.trim() || 'Reopened (status change reverted)',
        },
      },
    },
  });

  await notify.jobReopened(jobId, job.propertyId).catch(() => undefined);

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
// Inventory (supplies + linens, per property)
// ---------------------------------------------------------------------------

const inventorySchema = z.object({
  category: z.enum(['SUPPLY', 'LINEN']).default('SUPPLY'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  size: z.string().trim().max(60).optional().or(z.literal('')),
  unit: z.string().trim().max(40).optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(0).max(100000).default(0),
  parLevel: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(100000).optional(),
  ),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

/** Host or assigned cleaner adds an inventory item to a property. */
export async function addInventoryItem(propertyId: string, formData: FormData) {
  const user = await requireUser();
  if (!(await canAccessProperty(user, propertyId))) throw new Error('Not authorized.');
  const parsed = inventorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid item');
  const d = parsed.data;
  await prisma.inventoryItem.create({
    data: {
      propertyId,
      category: d.category as 'SUPPLY' | 'LINEN',
      name: d.name,
      size: d.size || null,
      unit: d.unit || null,
      quantity: d.quantity,
      parLevel: d.parLevel ?? null,
      notes: d.notes || null,
    },
  });
  revalidatePath(`/properties/${propertyId}`);
}

/** Edit an inventory item's fields. */
export async function updateInventoryItem(itemId: string, formData: FormData) {
  const user = await requireUser();
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Item not found.');
  if (!(await canAccessProperty(user, item.propertyId))) throw new Error('Not authorized.');
  const parsed = inventorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid item');
  const d = parsed.data;
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      category: d.category as 'SUPPLY' | 'LINEN',
      name: d.name,
      size: d.size || null,
      unit: d.unit || null,
      quantity: d.quantity,
      parLevel: d.parLevel ?? null,
      notes: d.notes || null,
    },
  });
  revalidatePath(`/properties/${item.propertyId}`);
}

/** Bump a single item's quantity up or down (clamped at 0) — the +/- steppers. */
export async function adjustInventoryQuantity(itemId: string, delta: number) {
  const user = await requireUser();
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Item not found.');
  if (!(await canAccessProperty(user, item.propertyId))) throw new Error('Not authorized.');
  const next = Math.max(0, Math.min(100000, item.quantity + delta));
  await prisma.inventoryItem.update({ where: { id: itemId }, data: { quantity: next } });
  revalidatePath(`/properties/${item.propertyId}`);
}

export async function deleteInventoryItem(itemId: string) {
  const user = await requireUser();
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  if (!(await canAccessProperty(user, item.propertyId))) throw new Error('Not authorized.');
  await prisma.inventoryItem.delete({ where: { id: itemId } });
  revalidatePath(`/properties/${item.propertyId}`);
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
  unitNumber: z.string().max(40).optional(),
  mainDoorAccess: z.string().max(300).optional(),
  ownerClosetAccess: z.string().max(300).optional(),
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
      unitNumber: d.unitNumber?.trim() || null,
      mainDoorAccess: encryptOptional(d.mainDoorAccess),
      ownerClosetAccess: encryptOptional(d.ownerClosetAccess),
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

// ---------------------------------------------------------------------------
// Financials (manual payment tracking + per-property expenses)
// ---------------------------------------------------------------------------

/** Auto-create a cleaning payment (status DUE) for a completed job, once. Uses
 * the property's cleaning price; skipped silently if there's no price set or a
 * payment already exists for the job. */
async function ensurePaymentForJob(jobId: string): Promise<void> {
  const existing = await prisma.payment.findUnique({ where: { jobId } });
  if (existing) return;
  const job = await prisma.turnoverJob.findUnique({
    where: { id: jobId },
    select: { id: true, propertyId: true, completedAt: true, price: true, property: { select: { cleaningPrice: true } } },
  });
  // Per-job price (manual jobs) wins over the property's standing cleaning price.
  const amount = job?.price ?? job?.property.cleaningPrice;
  if (!job || amount == null || amount <= 0) return;
  await prisma.payment.create({
    data: {
      propertyId: job.propertyId,
      jobId: job.id,
      amount,
      status: PaymentStatus.DUE,
      dueDate: job.completedAt ?? new Date(),
    },
  });
}

function parseDateInput(v: FormDataEntryValue | null): Date | undefined {
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

const paymentSchema = z.object({
  propertyId: z.string().min(1),
  amount: z.coerce.number().int().min(0).max(1_000_000),
  method: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.nativeEnum(PaymentMethod).optional()),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.DUE),
  reference: z.string().trim().max(200).optional().or(z.literal('')),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

/** Manually record a payment (host or assigned cleaner) against a property. */
export async function recordPayment(formData: FormData) {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid payment');
  const d = parsed.data;
  if (!(await canAccessProperty(user, d.propertyId))) throw new Error('Not authorized.');

  await prisma.payment.create({
    data: {
      propertyId: d.propertyId,
      amount: d.amount,
      method: d.method ?? null,
      status: d.status,
      dueDate: parseDateInput(formData.get('dueDate')) ?? null,
      paidAt: d.status === PaymentStatus.PAID ? new Date() : null,
      reference: d.reference?.trim() || null,
      note: d.note?.trim() || null,
      createdByUserId: user.id,
    },
  });
  revalidatePath('/financials');
  revalidatePath('/dashboard');
}

/** Mark a payment as paid (records method + reference + timestamp). */
export async function markPaymentPaid(paymentId: string, formData: FormData) {
  const user = await requireUser();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { propertyId: true } });
  if (!payment) throw new Error('Payment not found.');
  if (!(await canAccessProperty(user, payment.propertyId))) throw new Error('Not authorized.');

  const method = paymentSchema.shape.method.parse(formData.get('method') ?? undefined);
  const reference = String(formData.get('reference') ?? '').trim();
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.PAID,
      method: method ?? null,
      reference: reference || null,
      paidAt: new Date(),
    },
  });
  revalidatePath('/financials');
  revalidatePath('/dashboard');
}

/** Revert a payment back to Due (undo an accidental "paid"). */
export async function markPaymentDue(paymentId: string) {
  const user = await requireUser();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { propertyId: true } });
  if (!payment) throw new Error('Payment not found.');
  if (!(await canAccessProperty(user, payment.propertyId))) throw new Error('Not authorized.');
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.DUE, paidAt: null, confirmedAt: null },
  });
  revalidatePath('/financials');
  revalidatePath('/dashboard');
}

export async function deletePayment(paymentId: string) {
  const user = await requireUser();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { propertyId: true } });
  if (!payment) throw new Error('Payment not found.');
  if (!(await canAccessProperty(user, payment.propertyId))) throw new Error('Not authorized.');
  await prisma.payment.delete({ where: { id: paymentId } });
  revalidatePath('/financials');
  revalidatePath('/dashboard');
}

const RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

async function uploadReceipt(propertyId: string, formData: FormData): Promise<string | null> {
  const file = formData.get('receipt');
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Receipt is too large.');
  if (file.type && !RECEIPT_TYPES.has(file.type)) throw new Error('Receipt must be an image or PDF.');
  const ext = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await storeReceipt(propertyId, bytes, ext, file.type || 'application/octet-stream').catch(() => null);
  return stored?.url ?? null;
}

const expenseSchema = z.object({
  propertyId: z.string().min(1),
  amount: z.coerce.number().int().min(0).max(1_000_000),
  category: z.nativeEnum(ExpenseCategory).default(ExpenseCategory.OTHER),
  description: z.string().trim().min(1, 'Description is required').max(200),
  vendor: z.string().trim().max(120).optional().or(z.literal('')),
});

/** Host or assigned cleaner logs a per-property expense (with optional receipt). */
export async function addExpense(formData: FormData) {
  const user = await requireUser();
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid expense');
  const d = parsed.data;
  if (!(await canAccessProperty(user, d.propertyId))) throw new Error('Not authorized.');

  const receiptUrl = await uploadReceipt(d.propertyId, formData);
  await prisma.expense.create({
    data: {
      propertyId: d.propertyId,
      amount: d.amount,
      category: d.category,
      description: d.description,
      vendor: d.vendor?.trim() || null,
      incurredAt: parseDateInput(formData.get('incurredAt')) ?? new Date(),
      receiptUrl,
      createdByUserId: user.id,
    },
  });
  revalidatePath('/financials');
  revalidatePath('/dashboard');
}

export async function deleteExpense(expenseId: string) {
  const user = await requireUser();
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { propertyId: true, receiptUrl: true },
  });
  if (!expense) throw new Error('Expense not found.');
  if (!(await canAccessProperty(user, expense.propertyId))) throw new Error('Not authorized.');
  await deleteReceipt(expense.receiptUrl);
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath('/financials');
  revalidatePath('/dashboard');
}

// ---------------------------------------------------------------------------
// Account security
// ---------------------------------------------------------------------------

export interface PasswordFormState {
  error?: string;
  success?: boolean;
}

const passwordChangeSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Use at least 8 characters').max(200),
  confirmPassword: z.string(),
});

/** Self-service change password for the signed-in user (any role). Verifies the
 * current password when the account already has one. Uses the useActionState
 * shape (returns a state object) rather than throwing. */
export async function changePassword(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const user = await requireUser();
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' };
  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) return { error: 'New passwords do not match.' };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) return { error: 'Account not found.' };

  if (dbUser.passwordHash) {
    if (!currentPassword) return { error: 'Enter your current password.' };
    const ok = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!ok) return { error: 'Current password is incorrect.' };
    if (currentPassword === newPassword) {
      return { error: 'New password must be different from the current one.' };
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Payout profiles & payment confirmation.
// Payment freedom is the product stance: Ready2Rent never moves the money and
// never takes a cut. Cleaners say how they want to be paid; hosts pay them
// directly; both sides confirm — the ledger is ours, the money never is.
// ---------------------------------------------------------------------------

const payoutSchema = z.object({
  payoutMethod: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.nativeEnum(PaymentMethod).optional(),
  ),
  payoutHandle: z.string().trim().max(120).optional().or(z.literal('')),
});

/** Save how the signed-in user prefers to be paid (method + handle). */
export async function updatePayoutProfile(formData: FormData) {
  const user = await requireUser();
  const parsed = payoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid payout profile');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      payoutMethod: parsed.data.payoutMethod ?? null,
      payoutHandle: parsed.data.payoutHandle?.trim() || null,
    },
  });
  revalidatePath('/settings/payments');
  revalidatePath('/financials');
}

/** Payee's side of the two-sided receipt: confirm a PAID payment arrived. */
export async function confirmPaymentReceived(paymentId: string) {
  const user = await requireUser();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { propertyId: true, status: true },
  });
  if (!payment) throw new Error('Payment not found.');
  if (payment.status !== PaymentStatus.PAID) throw new Error('Only paid payments can be confirmed.');
  if (!(await canAccessProperty(user, payment.propertyId))) throw new Error('Not authorized.');
  await prisma.payment.update({ where: { id: paymentId }, data: { confirmedAt: new Date() } });
  revalidatePath('/financials');
}

// ---------------------------------------------------------------------------
// Team management (cleaning companies)
// ---------------------------------------------------------------------------

/** The caller's cleaning-company membership, or null if they have none. */
async function cleaningOrgMembership(userId: string) {
  return prisma.organizationMember.findFirst({
    where: { userId, organization: { type: 'CLEANING_COMPANY' } },
    select: { organizationId: true, role: true },
  });
}

/** Invite a cleaner to join the caller's cleaning company as a team member.
 * Accepting (existing account or via signup) joins them to the org, which puts
 * org-assigned jobs on their schedule. */
export async function inviteTeamMember(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const email = z
    .string()
    .email('Enter a valid email')
    .parse(String(formData.get('email') ?? '').trim().toLowerCase());

  const membership = await cleaningOrgMembership(user.id);
  if (!membership) throw new Error('No cleaning company found for this account.');
  if (membership.role === 'MEMBER') {
    throw new Error('Only the company owner or a manager can invite teammates.');
  }

  const dupe = await prisma.invitation.findFirst({
    where: { email, organizationId: membership.organizationId, propertyId: null, status: 'PENDING' },
  });
  if (dupe) {
    await sendInvitationEmail(dupe.id);
  } else {
    const invitation = await prisma.invitation.create({
      data: {
        email,
        invitedRole: UserRole.CLEANER,
        invitedByUserId: user.id,
        organizationId: membership.organizationId,
        propertyId: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await sendInvitationEmail(invitation.id);
  }
  revalidatePath('/cleaner/team');
}

/** Re-send a pending team invitation email (and refresh its expiry) — for
 * invites that have sat unanswered. Owner/manager only. */
export async function resendInvitation(invitationId: string) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const membership = await cleaningOrgMembership(user.id);
  if (!membership) throw new Error('No cleaning company found for this account.');
  if (membership.role === 'MEMBER') {
    throw new Error('Only the company owner or a manager can resend invites.');
  }

  const inv = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!inv || inv.organizationId !== membership.organizationId || inv.status !== 'PENDING') {
    throw new Error('Not authorized.');
  }
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  await sendInvitationEmail(invitationId);
  revalidatePath('/cleaner/team');
}

/** Hand a specific org-assigned job to a specific teammate ('' = back to the
 * shared pool). Only jobs assigned to the caller's cleaning company qualify. */
export async function assignJobToMember(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const jobId = String(formData.get('jobId') ?? '');
  const memberUserId = String(formData.get('memberUserId') ?? '');

  const membership = await cleaningOrgMembership(user.id);
  if (!membership) throw new Error('No cleaning company found for this account.');

  const job = await prisma.turnoverJob.findUnique({
    where: { id: jobId },
    select: { assignedOrganizationId: true },
  });
  if (!job || job.assignedOrganizationId !== membership.organizationId) {
    throw new Error('Not authorized.');
  }
  if (memberUserId) {
    const target = await prisma.organizationMember.findFirst({
      where: { organizationId: membership.organizationId, userId: memberUserId },
    });
    if (!target) throw new Error('That person is not on your team.');
  }
  await prisma.turnoverJob.update({
    where: { id: jobId },
    data: { assignedUserId: memberUserId || null },
  });
  revalidatePath('/cleaner/team');
  revalidatePath('/cleaner');
  revalidatePath(`/jobs/${jobId}`);
}

// ---------------------------------------------------------------------------
// Manual jobs (one-off / move-out / deep cleans) — no reservation behind them,
// same status engine, photos, and payment flow as calendar-synced turnovers.
// ---------------------------------------------------------------------------

const manualJobSchema = z.object({
  mode: z.enum(['existing', 'new']),
  propertyId: z.string().optional(),
  clientName: z.string().trim().max(160).optional().or(z.literal('')),
  clientAddress: z.string().trim().max(240).optional().or(z.literal('')),
  clientCity: z.string().trim().max(120).optional().or(z.literal('')),
  clientState: z.string().trim().max(60).optional().or(z.literal('')),
  clientDoorAccess: z.string().trim().max(300).optional().or(z.literal('')),
  type: z.enum(['ONE_OFF', 'MOVE_OUT', 'DEEP_CLEAN']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/).default('10:00'),
  price: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(100000).optional(),
  ),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

/** Schedule a one-off / move-out / deep clean, on an existing property or for
 * a new client (which quick-creates a minimal cleaner-managed property record
 * — no calendar feed, no owner-claim emails). */
export async function createManualJob(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const parsed = manualJobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid job');
  const d = parsed.data;

  const membership = await cleaningOrgMembership(user.id);

  let propertyId: string;
  let timezone: string;
  if (d.mode === 'existing') {
    if (!d.propertyId) throw new Error('Pick a property.');
    if (!(await canAccessProperty(user, d.propertyId))) throw new Error('Not authorized.');
    const prop = await prisma.property.findUnique({
      where: { id: d.propertyId },
      select: { timezone: true },
    });
    if (!prop) throw new Error('Property not found.');
    propertyId = d.propertyId;
    timezone = prop.timezone;
  } else {
    if (!membership) throw new Error('No cleaning company found for this account.');
    const clientName = d.clientName?.trim();
    if (!clientName) throw new Error('Client name is required.');
    const prop = await prisma.property.create({
      data: {
        name: clientName,
        address: d.clientAddress?.trim() || null,
        city: d.clientCity?.trim() || null,
        state: d.clientState?.trim() || null,
        mainDoorAccess: encryptOptional(d.clientDoorAccess),
        ownerOrganizationId: membership.organizationId,
        managementMode: 'CLEANER_MANAGED',
        createdByUserId: user.id,
        assignedCleanerOrganizationId: membership.organizationId,
        assignedCleanerUserId: user.id,
      },
    });
    propertyId = prop.id;
    timezone = prop.timezone;
  }

  // The date input is a plain calendar day; resolve start time as wall-clock
  // in the property's timezone (isAllDay: read Y/M/D from the UTC-midnight day).
  const checkout = resolveLocalDateTime(new Date(`${d.date}T00:00:00Z`), d.startTime, timezone, true);

  const job = await prisma.turnoverJob.create({
    data: {
      propertyId,
      type: d.type as JobType,
      price: d.price ?? null,
      checkoutDateTime: checkout,
      nextCheckInDateTime: null,
      sameDayTurnover: false,
      status: JobStatus.SCHEDULED,
      cleanerNotes: d.notes?.trim() || null,
      assignedOrganizationId: membership?.organizationId ?? null,
      assignedUserId: user.id,
      statusHistory: {
        create: { toStatus: JobStatus.SCHEDULED, changedByUserId: user.id, note: 'Manual job created' },
      },
    },
  });

  revalidatePath('/cleaner');
  revalidatePath('/jobs');
  redirect(`/jobs/${job.id}`);
}

// ---------------------------------------------------------------------------
// Business profile & member management (cleaning companies)
// ---------------------------------------------------------------------------

const businessSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required').max(160),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  serviceAreas: z.string().trim().max(400).optional().or(z.literal('')),
  bio: z.string().trim().max(1000).optional().or(z.literal('')),
});

/** Edit the cleaning company's name + public details. Details live on the
 * org's ServiceProviderProfile (the future marketplace/mini-site record), so
 * filling this in now seeds that later surface. Owner/manager only. */
export async function updateBusinessProfile(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const membership = await cleaningOrgMembership(user.id);
  if (!membership) throw new Error('No cleaning company found for this account.');
  if (membership.role === 'MEMBER') {
    throw new Error('Only the company owner or a manager can edit business details.');
  }

  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid business details');
  const d = parsed.data;
  const serviceAreas = (d.serviceAreas ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  await prisma.organization.update({
    where: { id: membership.organizationId },
    data: { name: d.name },
  });
  await prisma.serviceProviderProfile.upsert({
    where: { organizationId: membership.organizationId },
    update: {
      displayName: d.name,
      phone: d.phone?.trim() || null,
      bio: d.bio?.trim() || null,
      serviceAreas,
    },
    create: {
      organizationId: membership.organizationId,
      displayName: d.name,
      phone: d.phone?.trim() || null,
      bio: d.bio?.trim() || null,
      serviceAreas,
    },
  });
  revalidatePath('/cleaner/team');
  revalidatePath('/cleaner');
}

/** Change a teammate's role. Org owner only; you can't demote yourself while
 * you're the only owner (the org would be ownerless). */
export async function updateTeamMemberRole(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const memberId = String(formData.get('memberId') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!['OWNER', 'MANAGER', 'MEMBER'].includes(role)) throw new Error('Pick a valid role.');

  const membership = await cleaningOrgMembership(user.id);
  if (!membership || membership.role !== 'OWNER') {
    throw new Error('Only the company owner can change roles.');
  }
  const target = await prisma.organizationMember.findUnique({ where: { id: memberId } });
  if (!target || target.organizationId !== membership.organizationId) throw new Error('Not authorized.');

  if (target.userId === user.id && role !== 'OWNER') {
    const owners = await prisma.organizationMember.count({
      where: { organizationId: membership.organizationId, role: 'OWNER' },
    });
    if (owners <= 1) throw new Error('Add another owner before changing your own role.');
  }

  await prisma.organizationMember.update({
    where: { id: memberId },
    data: { role: role as MemberRole },
  });
  revalidatePath('/cleaner/team');
}

/** Remove a teammate from the company. Org owner only. Their open jobs go
 * back to the shared pool and their property assignments revert to the org;
 * completed history is untouched. */
export async function removeTeamMember(memberId: string) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const membership = await cleaningOrgMembership(user.id);
  if (!membership || membership.role !== 'OWNER') {
    throw new Error('Only the company owner can remove teammates.');
  }
  const target = await prisma.organizationMember.findUnique({ where: { id: memberId } });
  if (!target || target.organizationId !== membership.organizationId) throw new Error('Not authorized.');
  if (target.userId === user.id) throw new Error("You can't remove yourself.");

  const orgId = membership.organizationId;
  await prisma.$transaction([
    prisma.organizationMember.delete({ where: { id: memberId } }),
    // Their open jobs return to the pool; completed history stays theirs.
    prisma.turnoverJob.updateMany({
      where: {
        assignedOrganizationId: orgId,
        assignedUserId: target.userId,
        status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELED] },
      },
      data: { assignedUserId: null },
    }),
    // Property-level assignment falls back to the company.
    prisma.property.updateMany({
      where: { assignedCleanerOrganizationId: orgId, assignedCleanerUserId: target.userId },
      data: { assignedCleanerUserId: null },
    }),
  ]);
  revalidatePath('/cleaner/team');
  revalidatePath('/cleaner');
}

// ---------------------------------------------------------------------------
// Team new-hire onboarding checklist
// ---------------------------------------------------------------------------

/** Owner/manager gate shared by the onboarding-item actions. */
async function requireTeamManager(userId: string) {
  const membership = await cleaningOrgMembership(userId);
  if (!membership) throw new Error('No cleaning company found for this account.');
  if (membership.role === 'MEMBER') {
    throw new Error('Only the company owner or a manager can manage onboarding.');
  }
  return membership;
}

export async function addTeamOnboardingItem(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const membership = await requireTeamManager(user.id);
  const text = String(formData.get('text') ?? '').trim();
  if (!text || text.length > 200) throw new Error('Enter an item (max 200 characters).');

  const last = await prisma.teamOnboardingItem.findFirst({
    where: { organizationId: membership.organizationId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  await prisma.teamOnboardingItem.create({
    data: { organizationId: membership.organizationId, text, position: (last?.position ?? -1) + 1 },
  });
  revalidatePath('/cleaner/team');
}

/** Move a checklist item one slot up or down. Normalizes positions to their
 * sorted index first so swaps stay correct even if positions have gaps. */
export async function moveTeamOnboardingItem(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const membership = await requireTeamManager(user.id);
  const itemId = String(formData.get('itemId') ?? '');
  const direction = String(formData.get('direction') ?? '');
  if (direction !== 'up' && direction !== 'down') throw new Error('Invalid direction.');

  const items = await prisma.teamOnboardingItem.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const from = items.findIndex((i) => i.id === itemId);
  if (from === -1) throw new Error('Not authorized.');
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= items.length) return;

  [items[from], items[to]] = [items[to], items[from]];
  await prisma.$transaction(
    items.map((i, position) =>
      prisma.teamOnboardingItem.update({ where: { id: i.id }, data: { position } }),
    ),
  );
  revalidatePath('/cleaner/team');
}

export async function deleteTeamOnboardingItem(itemId: string) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const membership = await requireTeamManager(user.id);
  const item = await prisma.teamOnboardingItem.findUnique({ where: { id: itemId } });
  if (!item || item.organizationId !== membership.organizationId) throw new Error('Not authorized.');
  await prisma.teamOnboardingItem.delete({ where: { id: itemId } });
  revalidatePath('/cleaner/team');
}

const STARTER_ONBOARDING_ITEMS = [
  'Payout profile set — how they get paid',
  'Phone number added for schedule alerts',
  'W-9 / paperwork collected',
  'Supplies & products walkthrough',
  'Shadowed a clean with a senior teammate',
];

/** Seed the starter checklist (only when the org has no items yet). */
export async function addStarterOnboardingItems() {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const membership = await requireTeamManager(user.id);
  const count = await prisma.teamOnboardingItem.count({
    where: { organizationId: membership.organizationId },
  });
  if (count > 0) return;
  await prisma.teamOnboardingItem.createMany({
    data: STARTER_ONBOARDING_ITEMS.map((text, i) => ({
      organizationId: membership.organizationId,
      text,
      position: i,
    })),
  });
  revalidatePath('/cleaner/team');
}

/** Tick/untick an onboarding item for a teammate. Owner/manager only. */
export async function toggleTeamOnboardingCheck(formData: FormData) {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const membership = await requireTeamManager(user.id);
  const itemId = String(formData.get('itemId') ?? '');
  const memberId = String(formData.get('memberId') ?? '');

  const [item, member] = await Promise.all([
    prisma.teamOnboardingItem.findUnique({ where: { id: itemId } }),
    prisma.organizationMember.findUnique({ where: { id: memberId } }),
  ]);
  if (
    !item ||
    !member ||
    item.organizationId !== membership.organizationId ||
    member.organizationId !== membership.organizationId
  ) {
    throw new Error('Not authorized.');
  }

  const existing = await prisma.teamOnboardingCheck.findUnique({
    where: { itemId_memberId: { itemId, memberId } },
  });
  if (existing) {
    await prisma.teamOnboardingCheck.delete({ where: { id: existing.id } });
  } else {
    await prisma.teamOnboardingCheck.create({
      data: { itemId, memberId, checkedByUserId: user.id },
    });
  }
  revalidatePath('/cleaner/team');
}

// ---------------------------------------------------------------------------
// Per-user timezone (auto-detected from the browser)
// ---------------------------------------------------------------------------

/** Persist the viewer's detected IANA timezone. Called by the client
 * TimezoneSync component only when the detected zone differs from the stored
 * one, so this is a rare write. Silently ignores invalid zone strings. */
export async function saveUserTimezone(timezone: string): Promise<void> {
  const user = await requireUser();
  const tz = String(timezone || '').trim();
  if (!tz || tz.length > 64 || !isValidTimezone(tz)) return;
  await prisma.user.update({ where: { id: user.id }, data: { timezone: tz } });
  revalidatePath('/dashboard');
  revalidatePath('/cleaner');
}
