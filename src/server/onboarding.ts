import { prisma } from '@/lib/prisma';
import { getUserOrgIds, type SessionUser } from '@/lib/rbac';

export interface OnboardingState {
  hasProperty: boolean;
  hasFeed: boolean;
  hasJob: boolean;
  firstPropertyId: string | null;
  complete: boolean;
}

/** Progress signals for the owner's guided setup: property added → calendar
 * connected → first turnover job generated. Cheap counts over owned properties. */
export async function getOwnerOnboarding(user: SessionUser): Promise<OnboardingState> {
  const orgIds = await getUserOrgIds(user.id);
  const props = await prisma.property.findMany({
    where: { ownerOrganizationId: { in: orgIds }, active: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const ids = props.map((p) => p.id);

  const [feedCount, jobCount] = ids.length
    ? await Promise.all([
        prisma.calendarFeed.count({ where: { propertyId: { in: ids }, active: true } }),
        prisma.turnoverJob.count({ where: { propertyId: { in: ids } } }),
      ])
    : [0, 0];

  const hasProperty = ids.length > 0;
  const hasFeed = feedCount > 0;
  const hasJob = jobCount > 0;
  return {
    hasProperty,
    hasFeed,
    hasJob,
    firstPropertyId: ids[0] ?? null,
    complete: hasProperty && hasFeed && hasJob,
  };
}
