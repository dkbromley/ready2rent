'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { JOB_STATUS_META, formatTurnoverWindow } from '@/lib/status';
import type { JobStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

// 8-color palette — assigned deterministically per propertyId
const PALETTE = [
  { bar: '#3b82f6', text: '#fff' }, // blue
  { bar: '#8b5cf6', text: '#fff' }, // violet
  { bar: '#10b981', text: '#fff' }, // emerald
  { bar: '#f97316', text: '#fff' }, // orange
  { bar: '#ec4899', text: '#fff' }, // pink
  { bar: '#06b6d4', text: '#fff' }, // cyan
  { bar: '#d97706', text: '#fff' }, // amber
  { bar: '#ef4444', text: '#fff' }, // red
] as const;

function propertyColor(propertyId: string) {
  let hash = 0;
  for (const c of propertyId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[hash % PALETTE.length];
}

export interface CalendarJob {
  id: string;
  status: JobStatus;
  sameDayTurnover: boolean;
  checkInISO: string | null;
  checkoutISO: string;
  nextCheckInISO: string | null;
  turnoverWindowMinutes: number | null;
  propertyName: string;
  propertyId: string;
  timezone: string;
}

type ParsedJob = CalendarJob & { checkIn: Date | null; checkout: Date };
type View = 'month' | 'week' | 'day';

export function JobCalendar({ jobs }: { jobs: CalendarJob[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const parsed = useMemo<ParsedJob[]>(
    () =>
      jobs.map((j) => ({
        ...j,
        checkIn: j.checkInISO ? parseISO(j.checkInISO) : null,
        checkout: parseISO(j.checkoutISO),
      })),
    [jobs],
  );

  function shift(dir: -1 | 1) {
    setCursor((c) =>
      view === 'month' ? addMonths(c, dir) : view === 'week' ? addWeeks(c, dir) : addDays(c, dir),
    );
  }

  const title =
    view === 'month'
      ? format(cursor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(startOfWeek(cursor), 'MMM d')} – ${format(endOfWeek(cursor), 'MMM d, yyyy')}`
        : format(cursor, 'EEEE, MMMM d, yyyy');

  const openJob = (id: string) => router.push(`/jobs/${id}`);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            aria-label="Previous"
            className="rounded-lg p-2 text-navy-600 hover:bg-navy-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-xl px-3 py-1.5 text-sm font-medium text-navy-700 ring-1 ring-inset ring-navy-200 hover:bg-navy-50"
          >
            Today
          </button>
          <button
            onClick={() => shift(1)}
            aria-label="Next"
            className="rounded-lg p-2 text-navy-600 hover:bg-navy-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="ml-2 text-lg font-semibold text-navy-900">{title}</h2>
        </div>
        <div className="inline-flex rounded-xl bg-navy-100 p-0.5">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition',
                view === v ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-700',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && <MonthView cursor={cursor} jobs={parsed} onOpen={openJob} />}
      {view === 'week' && <WeekView cursor={cursor} jobs={parsed} onOpen={openJob} />}
      {view === 'day' && (
        <DayView
          day={cursor}
          jobs={parsed.filter((j) => isSameDay(j.checkout, cursor))}
          onOpen={openJob}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

function MonthView({
  cursor,
  jobs,
  onOpen,
}: {
  cursor: Date;
  jobs: ParsedJob[];
  onOpen: (id: string) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
      <div className="grid grid-cols-7 border-b border-navy-100 bg-navy-50 text-center text-xs font-semibold uppercase tracking-wide text-navy-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <MonthWeekRow
          key={wi}
          weekDays={week}
          jobs={jobs}
          cursor={cursor}
          onOpen={onOpen}
          isLastWeek={wi === weeks.length - 1}
        />
      ))}
    </div>
  );
}

function MonthWeekRow({
  weekDays,
  jobs,
  cursor,
  onOpen,
  isLastWeek,
}: {
  weekDays: Date[];
  jobs: ParsedJob[];
  cursor: Date;
  onOpen: (id: string) => void;
  isLastWeek: boolean;
}) {
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = endOfDay(weekDays[6]);

  // Jobs whose stay (checkIn → checkout) overlaps this week, sorted by start
  const bars = jobs
    .filter((j) => {
      const stayStart = j.checkIn ?? j.checkout;
      return stayStart <= weekEnd && j.checkout >= weekStart;
    })
    .sort((a, b) => {
      const aStart = (a.checkIn ?? a.checkout).getTime();
      const bStart = (b.checkIn ?? b.checkout).getTime();
      return aStart - bStart;
    })
    .map((job) => {
      const stayStart = job.checkIn ?? job.checkout;
      const startsInWeek = stayStart >= weekStart;
      const endsInWeek = job.checkout <= weekEnd;

      const startColIdx = startsInWeek
        ? weekDays.findIndex((d) => isSameDay(d, stayStart))
        : 0;
      const endColIdx = endsInWeek
        ? weekDays.findIndex((d) => isSameDay(d, job.checkout))
        : 6;

      const safeStart = Math.max(0, startColIdx);
      const safeEnd = Math.max(safeStart, endColIdx < 0 ? 6 : endColIdx);

      return {
        job,
        colStart: safeStart + 1,
        colSpan: safeEnd - safeStart + 1,
        startsInWeek,
        endsInWeek,
        stayStart,
      };
    });

  return (
    <div
      className={cn('grid grid-cols-7', !isLastWeek && 'border-b border-navy-100')}
      style={{ gridAutoRows: 'auto' }}
    >
      {/* Row 1: day number cells */}
      {weekDays.map((day, i) => {
        const inMonth = isSameMonth(day, cursor);
        return (
          <div
            key={day.toISOString()}
            className={cn(
              'min-h-[44px] border-r border-navy-50 p-1.5 last:border-r-0',
              !inMonth && 'bg-navy-50/40',
            )}
            style={{ gridColumn: i + 1, gridRow: 1 }}
          >
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                isToday(day)
                  ? 'bg-brand-600 font-bold text-white'
                  : inMonth
                    ? 'text-navy-600'
                    : 'text-navy-300',
              )}
            >
              {format(day, 'd')}
            </span>
          </div>
        );
      })}

      {/* Rows 2+: one bar per overlapping reservation */}
      {bars.map(({ job, colStart, colSpan, startsInWeek, endsInWeek, stayStart }, idx) => {
        const color = propertyColor(job.propertyId);
        const rounding = [
          startsInWeek ? '4px' : '0',
          endsInWeek ? '4px' : '0',
          endsInWeek ? '4px' : '0',
          startsInWeek ? '4px' : '0',
        ].join(' ');
        return (
          <button
            key={job.id}
            onClick={() => onOpen(job.id)}
            title={`${job.propertyName} · Check-in ${format(stayStart, 'MMM d h:mm a')} → Checkout ${format(job.checkout, 'MMM d h:mm a')}`}
            style={{
              gridColumn: `${colStart} / span ${colSpan}`,
              gridRow: idx + 2,
              backgroundColor: color.bar,
              color: color.text,
              borderRadius: rounding,
              marginLeft: startsInWeek ? '3px' : '0',
              marginRight: endsInWeek ? '3px' : '0',
            }}
            className={cn(
              'mb-1 truncate px-1.5 py-0.5 text-left text-[11px] font-medium leading-4',
              job.sameDayTurnover && 'ring-1 ring-inset ring-white/40',
            )}
          >
            {startsInWeek ? (
              <>
                <span className="opacity-75">{format(stayStart, 'h:mma')} </span>
                <span>{job.propertyName}</span>
                {endsInWeek && (
                  <span className="opacity-75"> → {format(job.checkout, 'h:mma')}</span>
                )}
              </>
            ) : (
              <>
                <span>{job.propertyName}</span>
                {endsInWeek && (
                  <span className="opacity-75"> → {format(job.checkout, 'h:mma')}</span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

function WeekView({
  cursor,
  jobs,
  onOpen,
}: {
  cursor: Date;
  jobs: ParsedJob[];
  onOpen: (id: string) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const weekEnd = endOfWeek(cursor);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Jobs overlapping this week
  const weekJobs = jobs.filter((j) => {
    const stayStart = j.checkIn ?? j.checkout;
    return stayStart <= endOfDay(weekEnd) && j.checkout >= startOfDay(weekStart);
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-navy-100 bg-navy-50">
        {days.map((day) => (
          <div key={day.toISOString()} className="border-r border-navy-100 p-2 text-center last:border-r-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{format(day, 'EEE')}</p>
            <span
              className={cn(
                'mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm',
                isToday(day) ? 'bg-brand-600 font-bold text-white' : 'text-navy-700',
              )}
            >
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* Bar grid — same multi-day span approach as month */}
      <div
        className="grid min-h-[80px] grid-cols-7 p-2"
        style={{ gridAutoRows: 'auto' }}
      >
        {weekJobs.length === 0 && (
          <p className="col-span-7 py-6 text-center text-sm text-navy-400">No turnovers this week.</p>
        )}
        {weekJobs
          .sort((a, b) => (a.checkIn ?? a.checkout).getTime() - (b.checkIn ?? b.checkout).getTime())
          .map((job, idx) => {
            const stayStart = job.checkIn ?? job.checkout;
            const startsInWeek = stayStart >= startOfDay(weekStart);
            const endsInWeek = job.checkout <= endOfDay(weekEnd);

            const startColIdx = startsInWeek
              ? days.findIndex((d) => isSameDay(d, stayStart))
              : 0;
            const endColIdx = endsInWeek
              ? days.findIndex((d) => isSameDay(d, job.checkout))
              : 6;

            const safeStart = Math.max(0, startColIdx);
            const safeEnd = Math.max(safeStart, endColIdx < 0 ? 6 : endColIdx);
            const color = propertyColor(job.propertyId);
            const rounding = [
              startsInWeek ? '6px' : '0',
              endsInWeek ? '6px' : '0',
              endsInWeek ? '6px' : '0',
              startsInWeek ? '6px' : '0',
            ].join(' ');

            return (
              <button
                key={job.id}
                onClick={() => onOpen(job.id)}
                title={`${job.propertyName} · ${format(stayStart, 'h:mm a')} → ${format(job.checkout, 'h:mm a')}`}
                style={{
                  gridColumn: `${safeStart + 1} / span ${safeEnd - safeStart + 1}`,
                  gridRow: idx + 1,
                  backgroundColor: color.bar,
                  color: color.text,
                  borderRadius: rounding,
                  marginLeft: startsInWeek ? '2px' : '0',
                  marginRight: endsInWeek ? '2px' : '0',
                }}
                className="mb-1.5 truncate px-2 py-1 text-left text-xs font-medium leading-4"
              >
                <span className="font-semibold">{job.propertyName}</span>
                {startsInWeek && (
                  <span className="ml-1 opacity-80">
                    {format(stayStart, 'h:mma')}
                    {endsInWeek && ` → ${format(job.checkout, 'h:mma')}`}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------

function DayView({
  day,
  jobs,
  onOpen,
}: {
  day: Date;
  jobs: ParsedJob[];
  onOpen: (id: string) => void;
}) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-navy-100 bg-white p-10 text-center text-sm text-navy-500 shadow-card">
        No turnovers on {format(day, 'EEEE, MMM d')}.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {jobs.map((j) => {
        const meta = JOB_STATUS_META[j.status];
        const color = propertyColor(j.propertyId);
        const stayStart = j.checkIn ?? j.checkout;
        return (
          <button
            key={j.id}
            onClick={() => onOpen(j.id)}
            className={cn(
              'card flex w-full items-stretch gap-0 overflow-hidden p-0 text-left transition hover:shadow-card-hover',
              j.sameDayTurnover && 'ring-1 ring-status-problem/30',
            )}
          >
            {/* Color stripe */}
            <div className="w-1.5 shrink-0" style={{ backgroundColor: color.bar }} />
            <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold text-navy-900">{j.propertyName}</p>
                <p className="mt-0.5 text-xs text-navy-500">
                  Check-in {format(stayStart, 'MMM d')} {format(stayStart, 'h:mm a')}
                  {' · '}
                  Checkout {format(j.checkout, 'h:mm a')}
                  {j.turnoverWindowMinutes != null && (
                    <> · {formatTurnoverWindow(j.turnoverWindowMinutes)}</>
                  )}
                </p>
              </div>
              <span
                className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', meta.chip)}
              >
                {meta.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
