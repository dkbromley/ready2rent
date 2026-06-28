import { MessageChannel, MessageStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Email transport (owner notifications, v1).
 *
 * Uses Resend's HTTP API when RESEND_API_KEY + EMAIL_FROM are configured. When
 * they're not, it degrades gracefully: the message is recorded in MessageLog as
 * SKIPPED and logged to the console, so the app works end-to-end before email is
 * wired up. Every attempt is recorded for audit/idempotency (mirrors SyncLog).
 *
 * To enable real sends: set RESEND_API_KEY and EMAIL_FROM (a verified sender,
 * e.g. "Ready2Rent <notify@yourdomain.com>") in env.
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  type: string;
  propertyId?: string;
  jobId?: string;
  ownerContactId?: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

export async function sendEmail(input: SendEmailInput): Promise<MessageStatus> {
  if (!isEmailConfigured()) {
    await logMessage(input, MessageStatus.SKIPPED, null, 'Email not configured (RESEND_API_KEY/EMAIL_FROM)');
    console.log(`[email:skipped] ${input.type} -> ${input.to} :: ${input.subject}`);
    return MessageStatus.SKIPPED;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => `${res.status}`);
      await logMessage(input, MessageStatus.FAILED, null, detail.slice(0, 500));
      return MessageStatus.FAILED;
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    await logMessage(input, MessageStatus.SENT, data.id ?? null, null);
    return MessageStatus.SENT;
  } catch (err) {
    await logMessage(input, MessageStatus.FAILED, null, err instanceof Error ? err.message : 'send failed');
    return MessageStatus.FAILED;
  }
}

async function logMessage(
  input: SendEmailInput,
  status: MessageStatus,
  providerId: string | null,
  error: string | null,
): Promise<void> {
  await prisma.messageLog.create({
    data: {
      channel: MessageChannel.EMAIL,
      type: input.type,
      toAddress: input.to,
      subject: input.subject,
      propertyId: input.propertyId,
      jobId: input.jobId,
      ownerContactId: input.ownerContactId,
      status,
      providerId,
      error,
    },
  });
}
