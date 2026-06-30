import { JobStatus, Prisma, ReservationStatus, SyncStatus, UserRole } from '@prisma/client';
import {
  startOfDay,
  endOfDay,
  addDays,
  startOfToday,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  format,
} from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getUserOrgIds, type SessionUser } from '@/lib/rbac';

export interface ActivityItem {
  id: string;
  jobId: string;
  toStatus: JobStatus;
  note: string | null;
  propertyName: string;
  createdAt: Date;
}

/** Turnovers per day for the current week (Mon–Sun), server-local buckets. */
async function weeklyTurnoverSeries(where: Prisma.TurnoverJobWhereInput) {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = endOfWeek(new Date(), { weekStartsOn: 1 });
  const jobs = await prisma.turnoverJob.findMany({
    where: { ...where, checkoutDateTime: { gte: start, lte: end } },
    select: { checkoutDateTime: true },
  });
  return eachDayOfInterval({ start, end }).map((d) => ({
    label: format(d, 'EEEEE'),
    count: jobs.filter((j) => isSameDay(j.checkoutDateTime, d)).length,
    isToday: isSameDay(d, new Date()),
  }));
}

/** Most recent job status transitions in scope — the "did it happen?" feed. */
async function recentActivity(jobWhere: Prisma.TurnoverJobWhereInput): Promise<ActivityItem[]> {
  const hist = await prisma.jobStatusHistory.findMany({
    where: { job: jobWhere },
    include: { job: { select: { property: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  return hist.map((h) => ({
    id: h.id,
    jobId: h.jobId,
    toStatus: h.toStatus,
    note: h.note,
    propertyName: h.job.property.name,
    createdAt: h.createdAt,
  }));
}

/**
 * Read models for the dashboards. All queries are scoped by role:
 *  - OWNER  -> properties owned by their org(s)
 *  - CLEANER-> jobs assigned to them or their org
 *  - ADMIN  -> everything
 *
 * Day-bucket boundaries use the server timezone for aggregate dashboards; the
 * per-property timezone is still authoritative for the stored job instants.
 */

/** Property-where scope for the owner/admin (relation filter, one round trip). */
export function ownerPropertyScope(user: SessionUser): Prisma.PropertyWhereInput {
  if (user.role === UserRole.ADMIN) return { active: true };
  return { active: true, ownerOrganization: { members: { some: { userId: user.id } } } };
}

export async function getOwnerScopePropertyIds(user: SessionUser): Promise<string[]> {
  const props = await prisma.property.findMany({
    where: ownerPropertyScope(user),
    select: { id: true },
  });
  return props.map((p) => p.id);
}

export async function getOwnerDashboard(user: SessionUser) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  // Scope every query by the property relation so there's no serial pre-fetch —
  // all of these run concurrently in one round of parallel queries.
  const propScope = ownerPropertyScope(user);
  const jobScope: Prisma.TurnoverJobWhereInput = {
    property: propScope,
    status: { notIn: [JobStatus.CANCELED] },
  };

  const [
    upcomingCheckouts,
    sameDayTurnovers,
    needingAssignment,
    inProgress,
    completedToday,
    syncErrors,
    propertyCount,
    weekly,
    activity,
  ] = await Promise.all([
    prisma.turnoverJob.findMany({
      where: {
        property: propScope,
        checkoutDateTime: { gte: todayStart, lte: weekEnd },
        status: { in: [JobStatus.NEEDS_SCHEDULING, JobStatus.SCHEDULED] },
      },
      include: { property: true, reservation: true },
      orderBy: { checkoutDateTime: 'asc' },
      take: 12,
    }),
    prisma.turnoverJob.findMany({
      where: { ...jobScope, sameDayTurnover: true, checkoutDateTime: { gte: todayStart } },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
      take: 8,
    }),
    prisma.property.findMany({
      where: { ...propScope, active: true, assignedCleanerOrganizationId: null, assignedCleanerUserId: null },
      take: 8,
    }),
    prisma.turnoverJob.count({ where: { property: propScope, status: JobStatus.IN_PROGRESS } }),
    prisma.turnoverJob.count({
      where: { property: propScope, status: JobStatus.COMPLETED, completedAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.calendarFeed.findMany({
      where: { property: propScope, lastSyncStatus: SyncStatus.FAILED },
      include: { property: true },
      take: 8,
    }),
    prisma.property.count({ where: propScope }),
    weeklyTurnoverSeries({ property: propScope }),
    recentActivity({ property: propScope }),
  ]);

  return {
    upcomingCheckouts,
    sameDayTurnovers,
    needingAssignment,
    inProgress,
    completedToday,
    syncErrors,
    propertyCount,
    weekly,
    activity,
  };
}

export async function getCleanerJobScope(user: SessionUser) {
  const orgIds = await getUserOrgIds(user.id);
  return {
    OR: [{ assignedUserId: user.id }, { assignedOrganizationId: { in: orgIds } }],
  };
}

export async function getCleanerDashboard(user: SessionUser) {
  const scope = await getCleanerJobScope(user);
  const today = startOfToday();
  const tomorrowStart = startOfDay(addDays(today, 1));
  const tomorrowEnd = endOfDay(addDays(today, 1));
  const weekEnd = endOfDay(addDays(today, 7));

  const liveStatuses = [
    JobStatus.NEEDS_SCHEDULING,
    JobStatus.SCHEDULED,
    JobStatus.IN_PROGRESS,
    JobStatus.PROBLEM,
  ];

  const [todays, tomorrows, thisWeek, sameDay, problems] = await Promise.all([
    prisma.turnoverJob.findMany({
      where: { ...scope, status: { in: liveStatuses }, checkoutDateTime: { gte: today, lte: endOfDay(today) } },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
    }),
    prisma.turnoverJob.findMany({
      where: { ...scope, status: { in: liveStatuses }, checkoutDateTime: { gte: tomorrowStart, lte: tomorrowEnd } },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
    }),
    prisma.turnoverJob.findMany({
      where: { ...scope, status: { in: liveStatuses }, checkoutDateTime: { gte: today, lte: weekEnd } },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
    }),
    prisma.turnoverJob.findMany({
      where: { ...scope, sameDayTurnover: true, status: { in: liveStatuses }, checkoutDateTime: { gte: today } },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
    }),
    prisma.turnoverJob.findMany({
      where: { ...scope, status: JobStatus.PROBLEM },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
    }),
  ]);

  const [weekly, activity] = await Promise.all([
    weeklyTurnoverSeries(scope),
    recentActivity(scope),
  ]);

  return { todays, tomorrows, thisWeek, sameDay, problems, weekly, activity };
}

/** Properties a cleaner manages or is assigned to (for the cleaner property list). */
export async function listCleanerProperties(user: SessionUser) {
  const orgIds = await getUserOrgIds(user.id);
  return prisma.property.findMany({
    where: {
      active: true,
      OR: [{ assignedCleanerUserId: user.id }, { assignedCleanerOrganizationId: { in: orgIds } }],
    },
    include: {
      calendarFeeds: true,
      ownerContact: true,
      _count: { select: { reservations: true, turnoverJobs: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Serializable turnover jobs in the cleaner's scope, for the calendar view. */
export async function getCleanerCalendarJobs(user: SessionUser) {
  const scope = await getCleanerJobScope(user);
  const jobs = await prisma.turnoverJob.findMany({
    where: {
      ...scope,
      status: { not: JobStatus.CANCELED },
      archivedAt: null,
      property: { active: true },
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          timezone: true,
          calendarColor: true,
          cleaningPrice: true,
        },
      },
      reservation: { select: { checkInDate: true } },
    },
    orderBy: { checkoutDateTime: 'asc' },
  });
  return jobs.map((j) => ({
    id: j.id,
    status: j.status,
    sameDayTurnover: j.sameDayTurnover,
    checkInISO: j.reservation?.checkInDate?.toISOString() ?? null,
    checkoutISO: j.checkoutDateTime.toISOString(),
    nextCheckInISO: j.nextCheckInDateTime ? j.nextCheckInDateTime.toISOString() : null,
    turnoverWindowMinutes: j.turnoverWindowMinutes,
    propertyName: j.property.name,
    propertyId: j.property.id,
    calendarColor: j.property.calendarColor,
    cleaningPrice: j.property.cleaningPrice,
    timezone: j.property.timezone,
  }));
}

export async function listProperties(user: SessionUser) {
  const propertyIds = await getOwnerScopePropertyIds(user);
  return prisma.property.findMany({
    where: { id: { in: propertyIds } },
    include: {
      calendarFeeds: true,
      assignedCleanerUser: true,
      assignedCleanerOrganization: true,
      _count: { select: { reservations: true, turnoverJobs: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPropertyDetail(propertyId: string) {
  return prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      calendarFeeds: { orderBy: { createdAt: 'asc' } },
      assignedCleanerUser: true,
      assignedCleanerOrganization: true,
      reservations: { orderBy: { checkOutDate: 'asc' } },
      turnoverJobs: {
        include: { reservation: true },
        orderBy: { checkoutDateTime: 'asc' },
      },
      checklistItems: { orderBy: { position: 'asc' } },
    },
  });
}

export async function getJobDetail(jobId: string) {
  return prisma.turnoverJob.findUnique({
    where: { id: jobId },
    include: {
      property: { include: { checklistItems: { orderBy: { position: 'asc' } } } },
      reservation: true,
      assignedUser: true,
      assignedOrganization: true,
      photos: { orderBy: { createdAt: 'desc' } },
      checklistChecks: true,
      statusHistory: {
        include: { changedByUser: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function listOwnerJobs(user: SessionUser) {
  const propertyIds = await getOwnerScopePropertyIds(user);
  // Active turnovers only — completed ones live in the Archive, archived ones
  // are hidden, canceled ones live in per-job history.
  return prisma.turnoverJob.findMany({
    where: {
      propertyId: { in: propertyIds },
      archivedAt: null,
      status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELED] },
    },
    include: { property: true, reservation: true },
    orderBy: { checkoutDateTime: 'asc' },
  });
}

/** Recently completed (not yet archived) jobs for the Archive view, role-scoped. */
export async function getArchivedJobs(user: SessionUser) {
  const where =
    user.role === UserRole.CLEANER
      ? { ...(await getCleanerJobScope(user)) }
      : { propertyId: { in: await getOwnerScopePropertyIds(user) } };

  return prisma.turnoverJob.findMany({
    where: { ...where, status: JobStatus.COMPLETED, archivedAt: null },
    include: { property: true, _count: { select: { photos: true } } },
    orderBy: { completedAt: 'desc' },
    take: 200,
  });
}

/** Cleaner orgs + users the owner can assign (for the assignment dropdown). */
export async function listAssignableCleaners() {
  const [orgs, users] = await Promise.all([
    prisma.organization.findMany({
      where: { type: 'CLEANING_COMPANY' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: UserRole.CLEANER },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { orgs, users };
}

// --- Admin read models ---

export async function getAdminSyncHealth() {
  const [feeds, recentLogs, failedLogs, totals] = await Promise.all([
    prisma.calendarFeed.findMany({
      include: { property: { select: { name: true, id: true } } },
      orderBy: { lastSyncedAt: 'desc' },
    }),
    prisma.syncLog.findMany({
      include: { property: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 30,
    }),
    prisma.syncLog.findMany({
      where: { status: SyncStatus.FAILED },
      include: { property: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    prisma.calendarFeed.groupBy({ by: ['lastSyncStatus'], _count: true }),
  ]);
  return { feeds, recentLogs, failedLogs, totals };
}

export async function getAdminOverview() {
  const [users, properties, orgs, jobs, reservations] = await Promise.all([
    prisma.user.count(),
    prisma.property.count(),
    prisma.organization.count(),
    prisma.turnoverJob.count(),
    prisma.reservation.count(),
  ]);
  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { memberships: { include: { organization: true } } },
  });
  return { users, properties, orgs, jobs, reservations, recentUsers };
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}
