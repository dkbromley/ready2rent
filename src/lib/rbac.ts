import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Role-based access control helpers.
 *
 * Authorization invariants (Phase 1):
 *  - Owners see only properties owned by an org they belong to.
 *  - Cleaners see only jobs/properties assigned to them or their org.
 *  - Admins see platform-wide sync health and all entities.
 *
 * Server components/route handlers call these to gate access and to scope
 * queries. They throw via redirect() when unauthenticated, keeping pages terse.
 */

export interface SessionUser {
  id: string;
  role: UserRole;
  name?: string | null;
  email?: string | null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/dashboard');
  return user;
}

/** Org ids the user belongs to (used to scope owner/cleaner queries). */
export async function getUserOrgIds(userId: string): Promise<string[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  return memberships.map((m) => m.organizationId);
}

/** True if the user may view/manage the given property. */
export async function canAccessProperty(
  user: SessionUser,
  propertyId: string,
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  const orgIds = await getUserOrgIds(user.id);
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      ownerOrganizationId: true,
      assignedCleanerOrganizationId: true,
      assignedCleanerUserId: true,
    },
  });
  if (!property) return false;
  if (orgIds.includes(property.ownerOrganizationId)) return true;
  if (
    property.assignedCleanerOrganizationId &&
    orgIds.includes(property.assignedCleanerOrganizationId)
  ) {
    return true;
  }
  return property.assignedCleanerUserId === user.id;
}

/** True if the user may view/update the given job. */
export async function canAccessJob(user: SessionUser, jobId: string): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  const job = await prisma.turnoverJob.findUnique({
    where: { id: jobId },
    select: { propertyId: true, assignedUserId: true, assignedOrganizationId: true },
  });
  if (!job) return false;
  if (job.assignedUserId === user.id) return true;
  const orgIds = await getUserOrgIds(user.id);
  if (job.assignedOrganizationId && orgIds.includes(job.assignedOrganizationId)) return true;
  return canAccessProperty(user, job.propertyId);
}
