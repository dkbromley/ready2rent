'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { requestPasswordReset } from '../actions';
import { Card, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, {});

  return (
    <Card className="p-7">
      <h1 className="text-xl font-bold text-navy-900">Reset your password</h1>

      {state.sent ? (
        <>
          <p className="mt-3 inline-flex items-start gap-2 text-sm text-navy-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-completed" />
            If an account exists for that email, we&apos;ve sent a link to reset your password.
            Check your inbox (and spam).
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-navy-500">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
          <form action={action} className="mt-6 space-y-4">
            <Field label="Email">
              <input name="email" type="email" autoComplete="email" required className={inputClass} />
            </Field>
            {state.error && <p className="text-sm text-status-problem">{state.error}</p>}
            <SubmitButton pendingText="Sending…" className="w-full">
              Send reset link
            </SubmitButton>
          </form>
          <p className="mt-6 text-center text-sm text-navy-500">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </Card>
  );
}
