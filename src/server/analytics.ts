import { JobStatus, Prisma, SyncStatus, UserRole } from '@prisma/client';
import { subDays, startOfWeek, addWeeks, endOfWeek, format } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getCleanerJobScope, ownerPropertyScope } from '@/server/queries';
import type { SessionUser } from '@/lib/rbac';

export interface TurnoverAnalytics {
  days: number;
  totalDue: number;
  completed: number;
  completionRate: number; // 0–100
  sameDay: number;
  problems: number;
  avgTurnaroundMin: number | null;
  onTimeRate: number | null; // 0–100, among completed jobs that had a next guest
  weekly: { label: string; value: number }[];
  perProperty: { name: string; completed: number; total: number; sameDay: number }[];
}

/**
 * Performance analytics over PAST-due turnovers (checkout within the last N days).
 * One query → all metrics computed in memory. Job rows persist through archival,
 * so history is never lost.
 */
export async function getTurnoverAnalytics(
  jobWhere: Prisma.TurnoverJobWhereInput,
  days = 30,
): Promise<TurnoverAnalytics> {
  const now = new Date();
  const since = subDays(now, days);

  const jobs = await prisma.turnoverJob.findMany({
    where: {
      ...jobWhere,
      status: { not: JobStatus.CANCELED },
      checkoutDateTime: { gte: since, lte: now },
    },
    select: {
      status: true,
      completedAt: true,
      checkoutDateTime: true,
      nextCheckInDateTime: true,
      sameDayTurnover: true,
      propertyId: true,
      property: { select: { name: true } },
    },
  });

  const completedJobs = jobs.filter((j) => j.status === JobStatus.COMPLETED && j.completedAt);
  const totalDue = jobs.length;
  const completed = completedJobs.length;

  const turnarounds = completedJobs.map((j) =>
    Math.max(0, (j.completedAt!.getTime() - j.checkoutDateTime.getTime()) / 60000),
  );
  const avgTurnaroundMin =
    turnarounds.length > 0
      ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
      : null;

  const withNext = completedJobs.filter((j) => j.nextCheckInDateTime);
  const onTime = withNext.filter((j) => j.completedAt!.getTime() <= j.nextCheckInDateTime!.getTime());
  const onTimeRate = withNext.length > 0 ? Math.round((onTime.length / withNext.length) * 100) : null;

  // Weekly completed trend (Mon-anchored buckets across the window).
  const weeks = Math.max(1, Math.ceil(days / 7));
  const firstWeekStart = startOfWeek(subDays(now, (weeks - 1) * 7), { weekStartsOn: 1 });
  const weekly = Array.from({ length: weeks }).map((_, i) => {
    const ws = addWeeks(firstWeekStart, i);
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const value = completedJobs.filter(
      (j) => j.completedAt! >= ws && j.completedAt! <= we,
    ).length;
    return { label: format(ws, 'MMM d'), value };
  });

  // Per-property breakdown.
  const byProp = new Map<string, { name: string; completed: number; total: number; sameDay: number }>();
  for (const j of jobs) {
    const cur = byProp.get(j.propertyId) ?? { name: j.property.name, completed: 0, total: 0, sameDay: 0 };
    cur.total++;
    if (j.status === JobStatus.COMPLETED) cur.completed++;
    if (j.sameDayTurnover) cur.sameDay++;
    byProp.set(j.propertyId, cur);
  }
  const perProperty = [...byProp.values()].sort((a, b) => b.total - a.total).slice(0, 8);

  return {
    days,
    totalDue,
    completed,
    completionRate: totalDue > 0 ? Math.round((completed / totalDue) * 100) : 0,
    sameDay: jobs.filter((j) => j.sameDayTurnover).length,
    problems: jobs.filter((j) => j.status === JobStatus.PROBLEM).length,
    avgTurnaroundMin,
    onTimeRate,
    weekly,
    perProperty,
  };
}

export async function getOwnerAnalytics(user: SessionUser, days = 30) {
  return getTurnoverAnalytics({ property: ownerPropertyScope(user) }, days);
}

export async function getCleanerAnalytics(user: SessionUser, days = 30) {
  return getTurnoverAnalytics(await getCleanerJobScope(user), days);
}

/** Platform-wide analytics for admins. */
export async function getPlatformAnalytics(days = 30) {
  const [users, owners, cleaners, properties, reservations, jobsTotal, statusGroups, syncGroups, turnover] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.OWNER } }),
      prisma.user.count({ where: { role: UserRole.CLEANER } }),
      prisma.property.count({ where: { active: true } }),
      prisma.reservation.count(),
      prisma.turnoverJob.count(),
      prisma.turnoverJob.groupBy({ by: ['status'], _count: true }),
      prisma.calendarFeed.groupBy({ by: ['lastSyncStatus'], _count: true }),
      getTurnoverAnalytics({}, days),
    ]);

  const statusDistribution = statusGroups
    .map((g) => ({ status: g.status, count: g._count }))
    .sort((a, b) => b.count - a.count);

  const syncSuccess = syncGroups.find((g) => g.lastSyncStatus === SyncStatus.SUCCESS)?._count ?? 0;
  const syncFailed = syncGroups.find((g) => g.lastSyncStatus === SyncStatus.FAILED)?._count ?? 0;
  const syncTotal = syncGroups.reduce((a, g) => a + g._count, 0);

  return {
    totals: { users, owners, cleaners, properties, reservations, jobs: jobsTotal },
    statusDistribution,
    sync: { success: syncSuccess, failed: syncFailed, total: syncTotal },
    turnover,
  };
}
