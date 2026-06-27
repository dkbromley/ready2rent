'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuthError } from 'next-auth';
import { OrganizationType, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signIn } from '@/auth';

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  role: z.enum(['OWNER', 'CLEANER']),
  orgName: z.string().max(160).optional(),
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
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }
  const { name, email, password, role, orgName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return { error: 'An account with that email already exists.' };

  const passwordHash = await bcrypt.hash(password, 10);

  // Create the user + their first organization + membership in one transaction.
  await prisma.user.create({
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
