'use client';

import { useFormStatus } from 'react-dom';
import { inputClass } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Assignment dropdown that saves on change — no separate Save button. Sits
 * inside a <form action={assignJobToMember}> with a hidden jobId input; a
 * noscript submit keeps the form usable without JS. */
export function AssignSelect({
  defaultValue,
  ariaLabel,
  options,
}: {
  defaultValue: string;
  ariaLabel: string;
  options: { value: string; label: string }[];
}) {
  const { pending } = useFormStatus();
  return (
    <span className="flex items-center gap-2">
      <select
        name="memberUserId"
        defaultValue={defaultValue}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={cn(inputClass, 'w-44 py-1.5', pending && 'opacity-60')}
        aria-label={ariaLabel}
      >
        <option value="">Unassigned (pool)</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span aria-live="polite" className="w-12 text-[11px] font-semibold text-brand-600">
        {pending ? 'Saving…' : ''}
      </span>
      <noscript>
        <button type="submit" className="text-xs font-semibold text-brand-700">
          Save
        </button>
      </noscript>
    </span>
  );
}
