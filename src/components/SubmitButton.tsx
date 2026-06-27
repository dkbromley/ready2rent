'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Submit button that reflects the parent <form action={serverAction}> pending
 * state via useFormStatus — shows a spinner + disables on click so server-action
 * forms give immediate feedback instead of appearing frozen for a few seconds.
 */
export function SubmitButton({
  children,
  pendingText,
  variant = 'primary',
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: Variant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {pendingText ?? 'Working…'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
