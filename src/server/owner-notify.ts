import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/server/email';
import { formatInTz } from '@/lib/datetime';

/**
 * Owner-facing notifications for the cleaner-led model.
 *
 * When a cleaner marks a turnover IN_PROGRESS / COMPLETED, the off-platform owner
 * gets an email (cleaning started / ready for arrival, plus the cleaner's notes).
 * Every email identifies the cleaner and links to a no-login status page + a
 * "join free" CTA — the incentive that pulls owners onto the platform — and an
 * unsubscribe link (CAN-SPAM hygiene).
 */
type Kind = 'started' | 'completed' | 'problem';

function appBase(): string {
  return process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://ready2rent.netlify.app';
}

export async function notifyOwnerOfJob(jobId: string, kind: Kind): Promise<void> {
  const job = await prisma.turnoverJob.findUnique({
    where: { id: jobId },
    include: {
      property: { include: { ownerContact: true } },
      assignedUser: { select: { name: true } },
      assignedOrganization: { select: { name: true } },
    },
  });

  const contact = job?.property.ownerContact;
  if (!job || !contact || contact.unsubscribed || !contact.notifyByEmail || !contact.email) {
    return; // nothing to send / owner opted out
  }

  const base = appBase();
  const propertyName = job.property.name;
  const tz = job.property.timezone;
  const cleaner =
    job.assignedUser?.name || job.assignedOrganization?.name || 'Your cleaner';
  const statusUrl = job.property.publicToken ? `${base}/p/${job.property.publicToken}` : base;
  const unsubUrl = `${base}/api/owner/unsubscribe?c=${contact.claimToken}`;
  const ownerFirst = contact.name?.split(' ')[0] || 'there';

  const subject =
    kind === 'started'
      ? `Turnover started at ${propertyName}`
      : kind === 'problem'
        ? `Problem reported at ${propertyName}`
        : `${propertyName} is clean and guest-ready`;

  const lead =
    kind === 'started'
      ? `${cleaner} has started the turnover at <strong>${propertyName}</strong>.`
      : kind === 'problem'
        ? `${cleaner} flagged a problem during the turnover at <strong>${propertyName}</strong> that may need your attention.`
        : `${cleaner} has finished the turnover at <strong>${propertyName}</strong> — it's clean and ready for your next guests.`;

  const checkoutLine = `Checkout: ${formatInTz(job.checkoutDateTime, tz)}`;
  const nextLine = job.nextCheckInDateTime
    ? `Next check-in: ${formatInTz(job.nextCheckInDateTime, tz)}`
    : '';
  // Surface the relevant note: cleaner's wrap-up on completion, the problem
  // description when flagged.
  const noteText = kind === 'problem' ? job.problemNote : kind === 'completed' ? job.cleanerNotes : null;
  const noteLabel = kind === 'problem' ? 'Problem details' : `Notes from ${cleaner}`;
  const notesBlock = noteText
    ? `<tr><td style="padding:12px 0"><div style="background:#f4efe2;border-radius:12px;padding:14px;color:#3e4d81;font-size:14px"><strong>${noteLabel}:</strong><br/>${escapeHtml(noteText)}</div></td></tr>`
    : '';

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1d2748">
    <div style="padding:20px 0">
      <span style="font-size:18px;font-weight:700;color:#138585">Ready2Rent</span>
    </div>
    <p>Hi ${escapeHtml(ownerFirst)},</p>
    <p style="font-size:15px;line-height:1.5">${lead}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#526dac">
      <tr><td style="padding:4px 0">${checkoutLine}</td></tr>
      ${nextLine ? `<tr><td style="padding:4px 0">${nextLine}</td></tr>` : ''}
      ${notesBlock}
    </table>
    <div style="padding:20px 0">
      <a href="${statusUrl}" style="background:#138585;color:#fff;text-decoration:none;padding:11px 18px;border-radius:12px;font-weight:600;font-size:14px">See live status &amp; photos</a>
    </div>
    <p style="font-size:13px;color:#85a3ca;line-height:1.5">
      You're getting this because ${escapeHtml(cleaner)} cleans this property for you and added it to Ready2Rent.
      Want to track every turnover yourself? <a href="${base}/claim/${contact.claimToken}" style="color:#138585">Claim this property free</a>.
    </p>
    <p style="font-size:12px;color:#adc3dd">
      <a href="${unsubUrl}" style="color:#adc3dd">Unsubscribe from these updates</a>
    </p>
  </div>`;

  await sendEmail({
    to: contact.email,
    subject,
    html,
    type: `owner_job_${kind}`,
    propertyId: job.propertyId,
    jobId: job.id,
    ownerContactId: contact.id,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
