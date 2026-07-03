import Link from 'next/link';
import { toZonedTime } from 'date-fns-tz';
import type { JobStatus } from '@prisma/client';
import { isSameLocalDay, formatInTz } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { NowMarker } from './NowMarker';

/**
 * Today's turnovers on a time axis: one row per job, a bar spanning the
 * cleaning window (checkout → next check-in), colored by status, with a live
 * "now" line. Server-rendered geometry — each bar is positioned in its own
 * property's timezone, so a multi-market host still reads every window as
 * local wall-clock time.
 */

export interface TimelineJob {
  id: string;
  status: JobStatus;
  sameDayTurnover: boolean;
  checkoutDateTime: Date;
  nextCheckInDateTime: Date | null;
  property: { name: string; timezone: string };
}

/** Fallback bar length when there's no same-day next check-in. */
const DEFAULT_WINDOW_MIN = 180;
const MAX_ROWS = 6;

const BAR_STYLE: Record<string, string> = {
  COMPLETED: 'bg-gradient-to-r from-brand-400 to-brand-600',
  IN_PROGRESS: 'bg-gradient-to-r from-violet-400 to-violet-600',
  PROBLEM: 'bg-gradient-to-r from-coral-400 to-coral-600',
  SAME_DAY: 'bg-gradient-to-r from-coral-400 to-coral-600',
  DEFAULT: 'bg-gradient-to-r from-sky-400 to-sky-600',
};

function localMinutes(instant: Date, tz: string): number {
  const z = toZonedTime(instant, tz);
  return z.getHours() * 60 + z.getMinutes();
}

export function TodayTimeline({ jobs }: { jobs: TimelineJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="card flex items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">Today&rsquo;s schedule</h2>
          <p className="mt-1.5 text-sm text-navy-400">
            No turnovers today — the next ones are queued up below.
          </p>
        </div>
      </div>
    );
  }

  const rows = jobs.slice(0, MAX_ROWS).map((j) => {
    const tz = j.property.timezone;
    const start = localMinutes(j.checkoutDateTime, tz);
    const sameDayEnd =
      j.nextCheckInDateTime && isSameLocalDay(j.checkoutDateTime, j.nextCheckInDateTime, tz)
        ? localMinutes(j.nextCheckInDateTime, tz)
        : null;
    const end = Math.min(24 * 60, Math.max(start + 45, sameDayEnd ?? start + DEFAULT_WINDOW_MIN));
    const style =
      j.status === 'COMPLETED' || j.status === 'IN_PROGRESS' || j.status === 'PROBLEM'
        ? BAR_STYLE[j.status]
        : j.sameDayTurnover
          ? BAR_STYLE.SAME_DAY
          : BAR_STYLE.DEFAULT;
    const label = `${formatInTz(j.checkoutDateTime, tz, 'h:mmaaaaa')}–${
      sameDayEnd != null && j.nextCheckInDateTime
        ? formatInTz(j.nextCheckInDateTime, tz, 'h:mmaaaaa')
        : 'open'
    }`;
    return { job: j, start, end, style, label };
  });

  // Axis bounds: cover every bar, never narrower than 8a–6p, snapped to hours.
  const startHour = Math.max(0, Math.min(8, ...rows.map((r) => Math.floor(r.start / 60))));
  const endHour = Math.min(24, Math.max(18, ...rows.map((r) => Math.ceil(r.end / 60))));
  const span = endHour - startHour;
  const labelStep = span > 12 ? 3 : 2;
  const pct = (minutes: number) => ((minutes - startHour * 60) / (span * 60)) * 100;

  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h += 1) hours.push(h);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">
          Today&rsquo;s schedule
        </h2>
        <div className="flex items-center gap-3 text-[11px] font-medium text-navy-400">
          <LegendDot className="bg-sky-500" label="Scheduled" />
          <LegendDot className="bg-coral-500" label="Same-day" />
          <LegendDot className="bg-violet-500" label="In progress" />
          <LegendDot className="bg-brand-500" label="Done" />
        </div>
      </div>

      <div className="flex">
        {/* property names, aligned with the rows on the right */}
        <div className="w-28 shrink-0 sm:w-36">
          <div className="h-6" />
          {rows.map(({ job }) => (
            <div key={job.id} className="flex h-11 items-center pr-3">
              <p className="truncate text-sm font-semibold text-navy-800">{job.property.name}</p>
            </div>
          ))}
        </div>

        {/* axis + bars */}
        <div className="relative min-w-0 flex-1">
          {/* hour labels */}
          <div className="relative h-6">
            {hours
              .filter((h) => (h - startHour) % labelStep === 0 && h < endHour)
              .map((h) => (
                <span
                  key={h}
                  className="absolute top-0 -translate-x-1/2 text-[10px] font-medium text-navy-300"
                  style={{ left: `${pct(h * 60)}%` }}
                >
                  {h % 12 === 0 ? 12 : h % 12}
                  {h < 12 ? 'a' : 'p'}
                </span>
              ))}
          </div>

          {/* gridlines behind every row */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-6">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute inset-y-0 w-px bg-sand-200/70"
                style={{ left: `${pct(h * 60)}%` }}
              />
            ))}
            <NowMarker startHour={startHour} endHour={endHour} timezone={jobs[0].property.timezone} />
          </div>

          {rows.map(({ job, start, end, style, label }) => (
            <div key={job.id} className="relative h-11">
              <Link
                href={`/jobs/${job.id}`}
                title={`${job.property.name} · ${label}`}
                className={cn(
                  'absolute bottom-2 top-2 flex items-center overflow-hidden rounded-lg px-2 shadow-sm transition hover:-translate-y-px hover:shadow-md',
                  style,
                )}
                style={{
                  left: `${pct(start)}%`,
                  width: `${Math.max(3.5, pct(end) - pct(start))}%`,
                }}
              >
                {job.status === 'IN_PROGRESS' && (
                  <span className="mr-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white" />
                )}
                <span className="truncate text-[10px] font-bold text-white">{label}</span>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {jobs.length > MAX_ROWS && (
        <p className="mt-2 text-right text-xs font-medium text-brand-700">
          <Link href="/jobs" className="hover:underline">
            +{jobs.length - MAX_ROWS} more today →
          </Link>
        </p>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="hidden items-center gap-1.5 sm:inline-flex">
      <span className={cn('h-2 w-2 rounded-full', className)} /> {label}
    </span>
  );
}
