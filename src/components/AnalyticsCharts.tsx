import { cn } from '@/lib/utils';

/** Generic vertical bar trend (e.g. completed turnovers per week). Dark-safe, no JS. */
export function TrendChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: 90 }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-medium text-navy-400">{d.value > 0 ? d.value : ''}</span>
            <div
              className={cn('w-full rounded-t-md', d.value === 0 ? 'bg-navy-100' : 'bg-brand-500')}
              style={{ height: d.value === 0 ? 3 : `${Math.round((d.value / max) * 70) + 6}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center text-[10px] text-navy-400">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
  sub?: string;
  tone?: 'teal' | 'coral' | 'navy';
}

const BAR_TONE = { teal: 'bg-brand-500', coral: 'bg-coral-500', navy: 'bg-navy-400' };

/** Horizontal labeled bars (e.g. per-property, status distribution). */
export function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  if (rows.length === 0) return <p className="text-sm text-navy-500">No data yet.</p>;
  const peak = Math.max(1, max ?? Math.max(...rows.map((r) => r.value)));
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-navy-700">{r.label}</span>
            <span className="shrink-0 font-medium text-navy-900">
              {r.value}
              {r.sub ? <span className="ml-1 text-xs font-normal text-navy-400">{r.sub}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-navy-100">
            <div
              className={cn('h-full rounded-full', BAR_TONE[r.tone ?? 'teal'])}
              style={{ width: `${Math.round((r.value / peak) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
