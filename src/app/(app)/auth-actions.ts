'use server';

import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/rbac';

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}

export interface DeleteAccountState {
  error?: string;
}

/**
 * Permanently delete the signed-in user's account.
 *
 * Organizations where the user is the *only* member are deleted too, which
 * cascades their owned properties and all related data (feeds, reservations,
 * jobs, checklists, inventory, payments, expenses). Shared orgs are left intact
 * — only the user's membership is removed. Cleaners are unassigned from any
 * properties/jobs (those FKs are ON DELETE SET NULL). Irreversible.
 *
 * Guarded by typing the account email; signs the user out on success.
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await requireUser();

  const confirm = String(formData.get('confirm') ?? '').trim().toLowerCase();
  if (!user.email || confirm !== user.email.toLowerCase()) {
    return { error: 'Type your email address exactly to confirm.' };
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    select: { organizationId: true },
  });
  const orgIds = memberships.map((m) => m.organizationId);

  let soloOrgIds: string[] = [];
  if (orgIds.length) {
    const counts = await prisma.organizationMember.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: orgIds } },
      _count: { userId: true },
    });
    soloOrgIds = counts.filter((c) => c._count.userId === 1).map((c) => c.organizationId);
  }

  await prisma.$transaction(async (tx) => {
    if (soloOrgIds.length) {
      await tx.organization.deleteMany({ where: { id: { in: soloOrgIds } } });
    }
    await tx.user.delete({ where: { id: user.id } });
  });

  await signOut({ redirectTo: '/' });
  return {};
}
