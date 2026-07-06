import { JobStatus, Prisma, ReservationStatus, SyncStatus, UserRole } from '@prisma/client';
import { startOfMonth } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getUserOrgIds, type SessionUser } from '@/lib/rbac';
import { startOfLocalDay, localDayKey } from '@/lib/datetime';

// Single-letter weekday labels, Monday-first (matches weeklyTurnoverSeries).
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface ActivityItem {
  id: string;
  jobId: string;
  toStatus: JobStatus;
  note: string | null;
  propertyName: string;
  createdAt: Date;
}

/** Turnovers per day for the current week (Mon–Sun) in the user's timezone. */
async function weeklyTurnoverSeries(where: Prisma.TurnoverJobWhereInput, tz: string) {
  const todayKey = localDayKey(new Date(), tz);
  // Day-of-week of the local today (0=Sun..6=Sat) → offset to Monday.
  const dow = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;

  const weekStart = startOfLocalDay(tz, mondayOffset);
  const weekEnd = startOfLocalDay(tz, mondayOffset + 7); // exclusive
  const jobs = await prisma.turnoverJob.findMany({
    where: { ...where, checkoutDateTime: { gte: weekStart, lt: weekEnd } },
    select: { checkoutDateTime: true },
  });

  return WEEKDAY_INITIALS.map((label, i) => {
    const dayKey = localDayKey(startOfLocalDay(tz, mondayOffset + i), tz);
    return {
      label,
      count: jobs.filter((j) => localDayKey(j.checkoutDateTime, tz) === dayKey).length,
      isToday: dayKey === todayKey,
    };
  });
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

export async function getOwnerDashboard(user: SessionUser, tz: string) {
  // Day boundaries in the user's timezone, as UTC instants: today, tomorrow
  // (today's exclusive end), and the end of the 7-day window (day 8's start).
  const todayStart = startOfLocalDay(tz, 0);
  const tomorrowStart = startOfLocalDay(tz, 1);
  const weekEnd = startOfLocalDay(tz, 8);

  // Scope every query by the property relation so there's no serial pre-fetch —
  // all of these run concurrently in one round of parallel queries.
  const propScope = ownerPropertyScope(user);
  const jobScope: Prisma.TurnoverJobWhereInput = {
    property: propScope,
    status: { notIn: [JobStatus.CANCELED] },
  };

  const [
    upcomingCheckouts,
    todaysJobs,
    problemJobs,
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
        checkoutDateTime: { gte: todayStart, lt: weekEnd },
        status: { in: [JobStatus.NEEDS_SCHEDULING, JobStatus.SCHEDULED] },
      },
      include: { property: true, reservation: true },
      orderBy: { checkoutDateTime: 'asc' },
      take: 12,
    }),
    // Everything happening today, whatever its state — feeds the timeline.
    prisma.turnoverJob.findMany({
      where: { ...jobScope, checkoutDateTime: { gte: todayStart, lt: tomorrowStart } },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
      take: 10,
    }),
    prisma.turnoverJob.findMany({
      where: { property: propScope, status: JobStatus.PROBLEM },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
      take: 6,
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
      where: { property: propScope, status: JobStatus.COMPLETED, completedAt: { gte: todayStart, lt: tomorrowStart } },
    }),
    prisma.calendarFeed.findMany({
      where: { property: propScope, lastSyncStatus: SyncStatus.FAILED },
      include: { property: true },
      take: 8,
    }),
    prisma.property.count({ where: propScope }),
    weeklyTurnoverSeries({ property: propScope }, tz),
    recentActivity({ property: propScope }),
  ]);

  return {
    upcomingCheckouts,
    todaysJobs,
    problemJobs,
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

export async function getCleanerDashboard(user: SessionUser, tz: string) {
  const scope = await getCleanerJobScope(user);
  // Day boundaries in the user's timezone, as UTC instants (exclusive ends).
  const today = startOfLocalDay(tz, 0);
  const tomorrowStart = startOfLocalDay(tz, 1);
  const dayAfterTomorrow = startOfLocalDay(tz, 2);
  const weekEnd = startOfLocalDay(tz, 8);

  const liveStatuses = [
    JobStatus.NEEDS_SCHEDULING,
    JobStatus.SCHEDULED,
    JobStatus.IN_PROGRESS,
    JobStatus.PROBLEM,
  ];

  const [todays, todaysAll, tomorrows, thisWeek, sameDay, problems] = await Promise.all([
    prisma.turnoverJob.findMany({
      where: { ...scope, status: { in: liveStatuses }, checkoutDateTime: { gte: today, lt: tomorrowStart } },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
    }),
    // Today in any state (completed included) — feeds the timeline + day ring.
    prisma.turnoverJob.findMany({
      where: {
        ...scope,
        status: { not: JobStatus.CANCELED },
        checkoutDateTime: { gte: today, lt: tomorrowStart },
      },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
      take: 10,
    }),
    prisma.turnoverJob.findMany({
      where: { ...scope, status: { in: liveStatuses }, checkoutDateTime: { gte: tomorrowStart, lt: dayAfterTomorrow } },
      include: { property: true },
      orderBy: { checkoutDateTime: 'asc' },
    }),
    prisma.turnoverJob.findMany({
      where: { ...scope, status: { in: liveStatuses }, checkoutDateTime: { gte: today, lt: weekEnd } },
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
    weeklyTurnoverSeries(scope, tz),
    recentActivity(scope),
  ]);

  return { todays, todaysAll, tomorrows, thisWeek, sameDay, problems, weekly, activity };
}

/**
 * Team read model for a cleaning company: members with this-month stats,
 * pending team invites, and the org's upcoming jobs (for per-member handoff).
 * Returns null when the user has no cleaning-company org.
 */
export async function getCleanerTeam(user: SessionUser) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organization: { type: 'CLEANING_COMPANY' } },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!membership) return null;
  const orgId = membership.organizationId;
  const monthStart = startOfMonth(new Date());
  // Rough 2-week worklist window; day-granular, so the app-default zone is fine.
  const today = startOfLocalDay(DEFAULT_TIMEZONE, 0);
  const worklistEnd = startOfLocalDay(DEFAULT_TIMEZONE, 15);

  const [members, pendingInvites, upcoming, completed, profile, me, onboardingItems] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true, payoutMethod: true, payoutHandle: true } },
        onboardingChecks: { select: { itemId: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invitation.findMany({
      where: { organizationId: orgId, propertyId: null, invitedRole: UserRole.CLEANER, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // The org's live queue for the next 2 weeks — the assignment worklist.
    prisma.turnoverJob.findMany({
      where: {
        assignedOrganizationId: orgId,
        status: { in: [JobStatus.NEEDS_SCHEDULING, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS] },
        checkoutDateTime: { gte: today, lt: worklistEnd },
      },
      include: {
        property: { select: { name: true, timezone: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { checkoutDateTime: 'asc' },
      take: 30,
    }),
    // Completed this month, for per-member counts + value.
    prisma.turnoverJob.findMany({
      where: { assignedOrganizationId: orgId, status: JobStatus.COMPLETED, completedAt: { gte: monthStart } },
      select: { assignedUserId: true, price: true, property: { select: { cleaningPrice: true } } },
    }),
    // Public business details (also seeds the future marketplace mini-site).
    prisma.serviceProviderProfile.findUnique({ where: { organizationId: orgId } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { payoutMethod: true, payoutHandle: true },
    }),
    // New-hire onboarding checklist template.
    prisma.teamOnboardingItem.findMany({
      where: { organizationId: orgId },
      orderBy: { position: 'asc' },
    }),
  ]);

  const statsByUser = new Map<string, { cleans: number; value: number }>();
  for (const j of completed) {
    const key = j.assignedUserId ?? '';
    const s = statsByUser.get(key) ?? { cleans: 0, value: 0 };
    s.cleans += 1;
    s.value += j.price ?? j.property.cleaningPrice ?? 0;
    statsByUser.set(key, s);
  }

  return {
    org: membership.organization,
    myRole: membership.role,
    profile,
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
      thisMonth: statsByUser.get(m.user.id) ?? { cleans: 0, value: 0 },
      checkedItemIds: new Set(m.onboardingChecks.map((c) => c.itemId)),
    })),
    onboardingItems,
    pendingInvites,
    upcoming,
    unassignedThisMonth: statsByUser.get('') ?? { cleans: 0, value: 0 },
    // Crew setup checklist — auto-derived, the card hides once all are true.
    setup: {
      hasDetails: Boolean(profile && (profile.phone || profile.bio || profile.serviceAreas.length > 0)),
      hasPayout: Boolean(me?.payoutMethod && me?.payoutHandle),
      hasTeammate: members.length > 1 || pendingInvites.length > 0,
      hasAssignment:
        upcoming.some((j) => j.assignedUser != null) || completed.some((c) => c.assignedUserId != null),
    },
  };
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
      invitations: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } },
      inventoryItems: { orderBy: [{ category: 'asc' }, { name: 'asc' }] },
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

/** The user's saved IANA timezone, or the app default when unset. Matches
 * Property.timezone's default so a brand-new account reads as Eastern until
 * the browser detection saves the real zone. */
export const DEFAULT_TIMEZONE = 'America/New_York';

export async function getUserTimezone(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return u?.timezone || DEFAULT_TIMEZONE;
}
