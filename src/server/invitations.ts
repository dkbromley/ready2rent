import { InviteStatus, JobStatus, OrganizationType, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/server/email';

/**
 * Host <-> cleaner invitations. A host can invite a cleaner to a property (or a
 * cleaner can invite a host); accepting links the invitee's account to the
 * property/org. The acceptance logic is shared by the accept action (logged-in
 * user) and the signup flow (just-created user), so both stay consistent.
 */

function appBase(): string {
  return process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://ready2rent.netlify.app';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function sendInvitationEmail(invitationId: string): Promise<void> {
  const inv = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { invitedBy: { select: { name: true, email: true } }, property: { select: { name: true } } },
  });
  if (!inv) return;

  const base = appBase();
  const link = `${base}/invite/${inv.token}`;
  const inviter = inv.invitedBy.name || inv.invitedBy.email;
  const roleWord = inv.invitedRole === UserRole.CLEANER ? 'cleaner' : 'host';
  const ctx = inv.property ? ` for <strong>${escapeHtml(inv.property.name)}</strong>` : '';

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:auto;color:#1d2748">
    <div style="padding:20px 0"><span style="font-size:18px;font-weight:700;color:#0d9488">Ready2Rent</span></div>
    <p style="font-size:15px;line-height:1.5">
      ${escapeHtml(inviter)} invited you to join Ready2Rent as the <strong>${roleWord}</strong>${ctx}.
    </p>
    <p style="font-size:14px;color:#526dac;line-height:1.5">
      Ready2Rent keeps vacation-rental turnovers in sync — checkout to clean, without the texts.
    </p>
    <div style="padding:18px 0">
      <a href="${link}" style="background:#0d9488;color:#fff;text-decoration:none;padding:11px 18px;border-radius:12px;font-weight:600;font-size:14px">Accept invitation</a>
    </div>
    <p style="font-size:12px;color:#adc3dd">If you didn't expect this, you can ignore this email.</p>
  </div>`;

  await sendEmail({
    to: inv.email,
    subject: `${inviter} invited you to Ready2Rent`,
    html,
    type: 'invitation',
    propertyId: inv.propertyId ?? undefined,
  });
}

export interface AcceptResult {
  ok: boolean;
  propertyId?: string | null;
  error?: string;
}

/**
 * Link a user to an invitation's property/org. Idempotent-ish: a non-pending
 * invite is rejected. Called by acceptInvitation (logged-in) and signup.
 */
export async function applyInvitationAcceptance(token: string, userId: string): Promise<AcceptResult> {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv) return { ok: false, error: 'Invitation not found.' };
  if (inv.status !== InviteStatus.PENDING) return { ok: false, error: 'This invitation is no longer valid.' };
  if (inv.expiresAt && inv.expiresAt < new Date()) return { ok: false, error: 'This invitation has expired.' };

  if (inv.propertyId && inv.invitedRole === UserRole.OWNER) {
    const prop = await prisma.property.findUnique({
      where: { id: inv.propertyId },
      select: { ownerOrganizationId: true, ownerOrganization: { select: { type: true } }, ownerContact: { select: { id: true } } },
    });
    if (prop) {
      if (prop.ownerOrganization.type === OrganizationType.OWNER) {
        // Already host-owned → invitee becomes a co-host on the same org.
        const exists = await prisma.organizationMember.findFirst({
          where: { userId, organizationId: prop.ownerOrganizationId },
        });
        if (!exists) {
          await prisma.organizationMember.create({
            data: { userId, organizationId: prop.ownerOrganizationId, role: 'MEMBER' },
          });
        }
      } else {
        // Cleaner-managed (owner org is the cleaning company): claim-style
        // transfer to the host's own OWNER org, leaving the cleaner assigned.
        let membership = await prisma.organizationMember.findFirst({
          where: { userId, organization: { type: OrganizationType.OWNER } },
          select: { organizationId: true },
        });
        if (!membership) {
          const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
          const org = await prisma.organization.create({
            data: { name: `${u?.name ?? 'My'} Rentals`, type: OrganizationType.OWNER },
          });
          await prisma.organizationMember.create({
            data: { userId, organizationId: org.id, role: 'OWNER' },
          });
          membership = { organizationId: org.id };
        }
        await prisma.property.update({
          where: { id: inv.propertyId },
          data: { ownerOrganizationId: membership.organizationId, managementMode: 'OWNER_MANAGED' },
        });
        if (prop.ownerContact) {
          await prisma.propertyOwnerContact.update({
            where: { id: prop.ownerContact.id },
            data: { claimedByUserId: userId, claimedAt: new Date(), notifyByEmail: false },
          });
        }
      }
    }
  } else if (inv.propertyId && inv.invitedRole === UserRole.CLEANER) {
    // Assign this cleaner (and their cleaning org, if any) to the property.
    const cleaningOrg = await prisma.organizationMember.findFirst({
      where: { userId, organization: { type: 'CLEANING_COMPANY' } },
      select: { organizationId: true },
    });
    const data = {
      assignedCleanerUserId: userId,
      assignedCleanerOrganizationId: cleaningOrg?.organizationId ?? null,
    };
    await prisma.property.update({ where: { id: inv.propertyId }, data });
    await prisma.turnoverJob.updateMany({
      where: { propertyId: inv.propertyId, status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELED] } },
      data,
    });
  } else if (inv.organizationId) {
    const exists = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: inv.organizationId },
    });
    if (!exists) {
      await prisma.organizationMember.create({
        data: { userId, organizationId: inv.organizationId, role: 'MEMBER' },
      });
    }
  }

  await prisma.invitation.update({
    where: { id: inv.id },
    data: { status: InviteStatus.ACCEPTED, acceptedByUserId: userId, acceptedAt: new Date() },
  });
  return { ok: true, propertyId: inv.propertyId };
}
