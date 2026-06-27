'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { OrganizationType, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signIn } from '@/auth';
import { getCurrentUser } from '@/lib/rbac';

export interface ClaimFormState {
  error?: string;
}

/**
 * Owner claim flow (cleaner-led → owner upgrade).
 *
 * The claimToken (an unguessable cuid delivered only in the owner's notification
 * email / status page) is the proof of ownership — same trust model as a magic
 * link. Claiming transfers the property record to the owner's own OWNER org and
 * flips it to OWNER_MANAGED, while leaving the assigned cleaner in place so their
 * jobs are uninterrupted. History is preserved.
 */
async function transferPropertyToOrg(contactId: string, propertyId: string, orgId: string, userId: string) {
  await prisma.$transaction([
    prisma.property.update({
      where: { id: propertyId },
      data: { ownerOrganizationId: orgId, managementMode: 'OWNER_MANAGED' },
    }),
    prisma.propertyOwnerContact.update({
      where: { id: contactId },
      // Owner is on-platform now; switch off the email nudges (they get in-app).
      data: { claimedByUserId: userId, claimedAt: new Date(), notifyByEmail: false },
    }),
  ]);
}

const newAccountSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export async function claimWithNewAccount(
  _prev: ClaimFormState,
  formData: FormData,
): Promise<ClaimFormState> {
  const parsed = newAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  const { token, name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const contact = await prisma.propertyOwnerContact.findUnique({ where: { claimToken: token } });
  if (!contact) return { error: 'This claim link is invalid or expired.' };
  if (contact.claimedByUserId) return { error: 'This property has already been claimed.' };

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return { error: 'An account with that email already exists — sign in to claim it instead.' };

  const passwordHash = await bcrypt.hash(password, 10);
  const org = await prisma.organization.create({
    data: { name: `${name}'s Rentals`, type: OrganizationType.OWNER },
  });
  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: UserRole.OWNER,
      memberships: { create: { organizationId: org.id, role: 'OWNER' } },
    },
  });

  await transferPropertyToOrg(contact.id, contact.propertyId, org.id, user.id);

  try {
    await signIn('credentials', { email: normalizedEmail, password, redirectTo: '/dashboard' });
  } catch (err) {
    if (err instanceof AuthError) return { error: 'Property claimed, but sign-in failed. Try logging in.' };
    throw err;
  }
  return {};
}

/** Claim as the already-signed-in owner (button on the claim page). */
export async function claimAsCurrentUser(token: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const contact = await prisma.propertyOwnerContact.findUnique({ where: { claimToken: token } });
  if (!contact || contact.claimedByUserId) return;

  let membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organization: { type: OrganizationType.OWNER } },
    select: { organizationId: true },
  });
  if (!membership) {
    const org = await prisma.organization.create({
      data: { name: `${user.name ?? 'My'} Rentals`, type: OrganizationType.OWNER },
    });
    await prisma.organizationMember.create({
      data: { userId: user.id, organizationId: org.id, role: 'OWNER' },
    });
    membership = { organizationId: org.id };
  }

  await transferPropertyToOrg(contact.id, contact.propertyId, membership.organizationId, user.id);
  redirect('/dashboard');
}
