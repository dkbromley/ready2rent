'use client';

import Link from 'next/link';
import { Suspense, useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Home, Sparkles } from 'lucide-react';
import { signupAction } from '../actions';
import { Card, Button, Field, inputClass } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  return (
    <Suspense fallback={<Card className="p-7"><p className="text-sm text-navy-500">Loading…</p></Card>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const params = useSearchParams();
  const invite = params.get('invite') ?? '';
  const invitedEmail = params.get('email') ?? '';
  const invitedRole = params.get('role') === 'CLEANER' ? 'CLEANER' : params.get('role') === 'OWNER' ? 'OWNER' : null;

  const [state, formAction, pending] = useActionState(signupAction, {});
  const [role, setRole] = useState<'OWNER' | 'CLEANER'>(invitedRole ?? 'OWNER');

  return (
    <Card className="p-7">
      <h1 className="text-xl font-bold text-navy-900">Create your account</h1>
      <p className="mt-1 text-sm text-navy-500">
        {invite ? 'Accept your invitation by creating an account.' : 'Get checkout-to-clean in sync in minutes.'}
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="role" value={role} />
        {invite && <input type="hidden" name="invite" value={invite} />}
        <div className="grid grid-cols-2 gap-3">
          <RoleCard
            active={role === 'OWNER'}
            onClick={() => setRole('OWNER')}
            icon={<Home className="h-5 w-5" />}
            title="Host"
            desc="I manage rentals"
          />
          <RoleCard
            active={role === 'CLEANER'}
            onClick={() => setRole('CLEANER')}
            icon={<Sparkles className="h-5 w-5" />}
            title="Cleaner"
            desc="I do turnovers"
          />
        </div>

        <Field label="Your name">
          <input name="name" required className={inputClass} />
        </Field>
        <Field label={role === 'OWNER' ? 'Business name (optional)' : 'Company name (optional)'}>
          <input name="orgName" className={inputClass} placeholder="Leave blank and we'll name it for you" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required defaultValue={invitedEmail} className={inputClass} />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </Field>

        {state.error && <p className="text-sm text-status-problem">{state.error}</p>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition',
        active
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
          : 'border-navy-200 bg-surface hover:border-navy-300',
      )}
    >
      <span className={cn('rounded-lg p-1.5', active ? 'bg-brand-600 text-white' : 'bg-navy-100 text-navy-600')}>
        {icon}
      </span>
      <span className="text-sm font-semibold text-navy-900">{title}</span>
      <span className="text-xs text-navy-500">{desc}</span>
    </button>
  );
}
