'use client';

import { useActionState, useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { changePassword, type PasswordFormState } from '@/server/actions';
import { Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

const initial: PasswordFormState = {};

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Current password">
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <Field label="Confirm new password">
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      {state.error && <p className="text-sm text-status-problem">{state.error}</p>}
      {state.success && (
        <p className="inline-flex items-center gap-1.5 text-sm text-status-completed">
          <CheckCircle2 className="h-4 w-4" /> Password updated.
        </p>
      )}

      <SubmitButton pendingText="Updating…">Update password</SubmitButton>
    </form>
  );
}
