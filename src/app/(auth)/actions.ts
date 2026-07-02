'use server';

import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { AuthError } from 'next-auth';
import { OrganizationType, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signIn } from '@/auth';
import { applyInvitationAcceptance } from '@/server/invitations';
import { sendEmail } from '@/server/email';

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  role: z.enum(['OWNER', 'CLEANER']),
  orgName: z.string().max(160).optional(),
  invite: z.string().optional(),
});

export interface AuthFormState {
  error?: string;
}

const ROLE_TO_ORG_TYPE: Record<'OWNER' | 'CLEANER', OrganizationType> = {
  OWNER: OrganizationType.OWNER,
  CLEANER: OrganizationType.CLEANING_COMPANY,
};

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
    orgName: formData.get('orgName') || undefined,
    invite: formData.get('invite') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }
  const { name, email, password, role, orgName, invite } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return { error: 'An account with that email already exists.' };

  const passwordHash = await bcrypt.hash(password, 10);

  // Create the user + their first organization + membership in one transaction.
  const newUser = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: role as UserRole,
      memberships: {
        create: {
          role: 'OWNER',
          organization: {
            create: {
              name: orgName || `${name}'s ${role === 'OWNER' ? 'Rentals' : 'Cleaning Co.'}`,
              type: ROLE_TO_ORG_TYPE[role],
            },
          },
        },
      },
    },
  });

  // If they arrived via an invitation, link them to the property/org now.
  if (invite) {
    await applyInvitationAcceptance(invite, newUser.id).catch(() => undefined);
  }

  try {
    await signIn('credentials', {
      email: normalizedEmail,
      password,
      redirectTo: '/dashboard',
    });
  } catch (err) {
    // signIn throws a redirect on success; re-throw so Next handles it.
    if (err instanceof AuthError) return { error: 'Account created, but sign-in failed. Try logging in.' };
    throw err;
  }
  return {};
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };

  try {
    await signIn('credentials', { email, password, redirectTo: '/dashboard' });
  } catch (err) {
    if (err instanceof AuthError) return { error: 'Invalid email or password.' };
    throw err;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Password reset (forgot password) — logged-out flow
// ---------------------------------------------------------------------------

function appBase(): string {
  return process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://ready2rent.io';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

async function sendPasswordResetEmail(to: string, name: string | null, rawToken: string): Promise<void> {
  const link = `${appBase()}/reset-password/${rawToken}`;
  const hi = name ? `Hi ${escapeHtml(name.split(' ')[0])},` : 'Hi,';
  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:auto;color:#1d2748">
    <div style="padding:20px 0"><span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#1d2748">Ready<span style="color:#0d9488">2</span>Rent</span></div>
    <p style="font-size:15px;line-height:1.5">${hi}</p>
    <p style="font-size:15px;line-height:1.5">We got a request to reset your Ready2Rent password. Click below to choose a new one — the link expires in 1 hour.</p>
    <div style="padding:18px 0">
      <a href="${link}" style="background:#0d9488;color:#fff;text-decoration:none;padding:11px 18px;border-radius:12px;font-weight:600;font-size:14px">Reset password</a>
    </div>
    <p style="font-size:13px;color:#526dac;line-height:1.5">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  </div>`;
  await sendEmail({ to, subject: 'Reset your Ready2Rent password', html, type: 'password_reset' });
}

export interface ResetRequestState {
  sent?: boolean;
  error?: string;
}

const forgotSchema = z.object({ email: z.string().email('Enter a valid email') });

/** Step 1: email a reset link. Always returns a generic result — never reveals
 * whether an account exists for the address. */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = forgotSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Enter a valid email.' };
  const email = parsed.data.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (user) {
    // One live token per user.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await sendPasswordResetEmail(user.email, user.name, rawToken).catch(() => undefined);
  }
  return { sent: true };
}

export interface ResetPasswordState {
  error?: string;
  success?: boolean;
}

const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Use at least 8 characters').max(200),
  confirmPassword: z.string(),
});

/** Step 2: consume a token and set a new password. */
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' };
  const { token, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) return { error: 'Passwords do not match.' };

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: 'This reset link is invalid or has expired. Request a new one.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Consume this token and drop any other outstanding ones for the user.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  return { success: true };
}
