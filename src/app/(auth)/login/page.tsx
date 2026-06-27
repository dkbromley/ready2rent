'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '../actions';
import { Card, Button, Field, inputClass } from '@/components/ui';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {});

  return (
    <Card className="p-7">
      <h1 className="text-xl font-bold text-navy-900">Welcome back</h1>
      <p className="mt-1 text-sm text-navy-500">Sign in to your TurnReady account.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>

        {state.error && <p className="text-sm text-status-problem">{state.error}</p>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-500">
        New to TurnReady?{' '}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
