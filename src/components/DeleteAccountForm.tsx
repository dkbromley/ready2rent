'use client';

import { useActionState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteAccount } from '@/app/(app)/auth-actions';
import { inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action] = useActionState(deleteAccount, {});

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!confirm('Permanently delete your account? This cannot be undone.')) e.preventDefault();
      }}
    >
      <p className="text-sm text-navy-600">
        This permanently deletes your account and any properties, turnovers, and financial records
        you solely own. It can&apos;t be undone.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-navy-600">
          Type <span className="font-semibold text-navy-800">{email}</span> to confirm
        </span>
        <input name="confirm" autoComplete="off" spellCheck={false} className={inputClass} placeholder={email} />
      </label>
      {state.error && <p className="text-sm text-status-problem">{state.error}</p>}
      <SubmitButton variant="danger" pendingText="Deleting…">
        <Trash2 className="h-4 w-4" /> Delete my account
      </SubmitButton>
    </form>
  );
}
