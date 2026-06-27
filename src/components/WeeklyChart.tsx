import { cn } from '@/lib/utils';

export interface WeeklyPoint {
  label: string;
  count: number;
  isToday: boolean;
}

/** Compact CSS bar chart of turnovers per day this week. No JS, dark-safe. */
export function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 76 }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-medium text-navy-400">{d.count > 0 ? d.count : ''}</span>
            <div
              className={cn(
                'w-full rounded-t-md',
                d.count === 0 ? 'bg-navy-100' : d.isToday ? 'bg-brand-600' : 'bg-brand-300',
              )}
              style={{ height: d.count === 0 ? 3 : `${Math.round((d.count / max) * 60) + 6}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={i}
            className={cn('flex-1 text-center text-[10px]', d.isToday ? 'font-semibold text-brand-700' : 'text-navy-400')}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
