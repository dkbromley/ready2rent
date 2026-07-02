'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { resetPassword } from '@/app/(auth)/actions';
import { Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, {});

  if (state.success) {
    return (
      <div>
        <p className="inline-flex items-center gap-2 text-sm text-navy-600">
          <CheckCircle2 className="h-4 w-4 text-status-completed" /> Your password has been reset.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(20,184,166,0.55)] transition hover:-translate-y-px"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" hint="At least 8 characters.">
        <input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Confirm new password">
        <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      {state.error && <p className="text-sm text-status-problem">{state.error}</p>}
      <SubmitButton pendingText="Saving…" className="w-full">
        Set new password
      </SubmitButton>
    </form>
  );
}
