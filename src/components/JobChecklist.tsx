'use client';

import { useTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { toggleJobChecklistItem } from '@/server/actions';
import { cn } from '@/lib/utils';

export interface JobChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

/**
 * Per-job checklist. Cleaners tick items off (optimistic, persisted per job);
 * hosts/admins see read-only progress.
 */
export function JobChecklist({
  jobId,
  items,
  canCheck,
}: {
  jobId: string;
  items: JobChecklistItem[];
  canCheck: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, toggleOptimistic] = useOptimistic(
    items,
    (state: JobChecklistItem[], toggledId: string) =>
      state.map((i) => (i.id === toggledId ? { ...i, checked: !i.checked } : i)),
  );

  const done = optimistic.filter((i) => i.checked).length;

  function toggle(itemId: string) {
    if (!canCheck) return;
    startTransition(async () => {
      toggleOptimistic(itemId);
      await toggleJobChecklistItem(jobId, itemId);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-navy-500">No checklist set for this property yet.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-navy-400">
          {done} / {optimistic.length} done
        </p>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-navy-100">
          <div
            className="h-full rounded-full bg-status-completed transition-all"
            style={{ width: `${optimistic.length ? (done / optimistic.length) * 100 : 0}%` }}
          />
        </div>
      </div>
      <ul className="space-y-1.5">
        {optimistic.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={!canCheck}
              onClick={() => toggle(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-sm transition',
                canCheck && 'hover:bg-navy-50',
                !canCheck && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition',
                  item.checked
                    ? 'bg-status-completed text-white ring-status-completed'
                    : 'bg-surface ring-navy-300',
                )}
              >
                {item.checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className={cn(item.checked ? 'text-navy-400 line-through' : 'text-navy-800')}>
                {item.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
