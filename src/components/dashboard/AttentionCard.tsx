import Link from 'next/link';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The dashboard's triage inbox: everything that needs the host's eyes —
 * failed calendar syncs, problem reports, unassigned properties, outstanding
 * payments — in one prioritized list instead of scattered banners.
 */

export interface AttentionItem {
  id: string;
  severity: 'high' | 'medium';
  title: string;
  detail?: string;
  href: string;
}

export function AttentionCard({ items }: { items: AttentionItem[] }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">Needs attention</h2>
        {items.length > 0 && (
          <span
            className={cn(
              'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
              items.some((i) => i.severity === 'high')
                ? 'bg-coral-50 text-coral-600 ring-1 ring-inset ring-coral-600/20'
                : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
            )}
          >
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-3 ring-1 ring-inset ring-brand-600/10">
          <CircleCheck className="h-5 w-5 shrink-0 text-brand-600" />
          <p className="text-sm text-navy-700">
            <span className="font-semibold">All clear.</span> Calendars synced, no problems reported.
          </p>
        </div>
      ) : (
        <ul className="-mx-2">
          {items.slice(0, 6).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-sand-50"
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    item.severity === 'high' ? 'bg-coral-500' : 'bg-amber-500',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-navy-800">{item.title}</span>
                  {item.detail && <span className="block truncate text-xs text-navy-400">{item.detail}</span>}
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
