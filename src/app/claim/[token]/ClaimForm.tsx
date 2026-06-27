'use client';

import { useActionState } from 'react';
import { claimWithNewAccount } from '../actions';
import { Button, Field, inputClass } from '@/components/ui';

export function ClaimForm({ token, defaultEmail }: { token: string; defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(claimWithNewAccount, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Your name">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={defaultEmail} required className={inputClass} />
      </Field>
      <Field label="Create a password" hint="At least 8 characters">
        <input name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>

      {state.error && <p className="text-sm text-status-problem">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Claiming…' : 'Claim property & create account'}
      </Button>
    </form>
  );
}
