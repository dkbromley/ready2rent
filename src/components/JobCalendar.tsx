'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { JOB_STATUS_META, formatTurnoverWindow } from '@/lib/status';
import type { JobStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

export interface CalendarJob {
  id: string;
  status: JobStatus;
  sameDayTurnover: boolean;
  checkoutISO: string;
  nextCheckInISO: string | null;
  turnoverWindowMinutes: number | null;
  propertyName: string;
  timezone: string;
}

type View = 'month' | 'week' | 'day';

export function JobCalendar({ jobs }: { jobs: CalendarJob[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>('month');
  // Anchor on the most relevant date; default to today.
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const parsed = useMemo(
    () => jobs.map((j) => ({ ...j, date: parseISO(j.checkoutISO) })),
    [jobs],
  );

  const jobsForDay = (day: Date) => parsed.filter((j) => isSameDay(j.date, day));

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

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="rounded-lg p-2 text-navy-600 hover:bg-navy-50" aria-label="Previous">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setCursor(new Date())} className="rounded-xl px-3 py-1.5 text-sm font-medium text-navy-700 ring-1 ring-inset ring-navy-200 hover:bg-navy-50">
            Today
          </button>
          <button onClick={() => shift(1)} className="rounded-lg p-2 text-navy-600 hover:bg-navy-50" aria-label="Next">
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

      {view === 'month' && <MonthView cursor={cursor} jobsForDay={jobsForDay} onOpen={(id) => router.push(`/jobs/${id}`)} />}
      {view === 'week' && <WeekView cursor={cursor} jobsForDay={jobsForDay} onOpen={(id) => router.push(`/jobs/${id}`)} />}
      {view === 'day' && <DayView day={cursor} jobs={jobsForDay(cursor)} onOpen={(id) => router.push(`/jobs/${id}`)} />}
    </div>
  );
}

type DayJob = CalendarJob & { date: Date };

function Chip({ job, onOpen }: { job: DayJob; onOpen: (id: string) => void }) {
  const meta = JOB_STATUS_META[job.status];
  return (
    <button
      onClick={() => onOpen(job.id)}
      title={`${job.propertyName} · ${meta.label}`}
      className={cn(
        'flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ring-1 ring-inset',
        meta.chip,
        job.sameDayTurnover && 'ring-status-problem/40',
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
      <span className="truncate">{format(job.date, 'h:mma').toLowerCase()} {job.propertyName}</span>
    </button>
  );
}

function MonthView({
  cursor,
  jobsForDay,
  onOpen,
}: {
  cursor: Date;
  jobsForDay: (d: Date) => DayJob[];
  onOpen: (id: string) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  });
  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
      <div className="grid grid-cols-7 border-b border-navy-100 bg-navy-50 text-center text-xs font-semibold uppercase tracking-wide text-navy-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayJobs = jobsForDay(day);
          const inMonth = isSameMonth(day, cursor);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[92px] border-b border-r border-navy-50 p-1.5 last:border-r-0',
                !inMonth && 'bg-navy-50/40',
              )}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday(day) ? 'bg-brand-600 font-bold text-white' : inMonth ? 'text-navy-600' : 'text-navy-300',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1">
                {dayJobs.slice(0, 3).map((j) => (
                  <Chip key={j.id} job={j} onOpen={onOpen} />
                ))}
                {dayJobs.length > 3 && (
                  <p className="px-1 text-[11px] font-medium text-navy-400">+{dayJobs.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  jobsForDay,
  onOpen,
}: {
  cursor: Date;
  jobsForDay: (d: Date) => DayJob[];
  onOpen: (id: string) => void;
}) {
  const days = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const dayJobs = jobsForDay(day);
        return (
          <div key={day.toISOString()} className="rounded-2xl border border-navy-100 bg-white p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-navy-500">{format(day, 'EEE')}</span>
              <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs', isToday(day) ? 'bg-brand-600 font-bold text-white' : 'text-navy-600')}>
                {format(day, 'd')}
              </span>
            </div>
            <div className="space-y-1">
              {dayJobs.length === 0 ? (
                <p className="text-xs text-navy-300">—</p>
              ) : (
                dayJobs.map((j) => <Chip key={j.id} job={j} onOpen={onOpen} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ day, jobs, onOpen }: { day: Date; jobs: DayJob[]; onOpen: (id: string) => void }) {
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
        return (
          <button
            key={j.id}
            onClick={() => onOpen(j.id)}
            className={cn('card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:shadow-card-hover', j.sameDayTurnover && 'ring-1 ring-status-problem/30')}
          >
            <div className="flex items-center gap-3">
              <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
              <div>
                <p className="font-semibold text-navy-900">{j.propertyName}</p>
                <p className="text-xs text-navy-500">
                  Checkout {format(j.date, 'h:mm a')} · {formatTurnoverWindow(j.turnoverWindowMinutes)}
                </p>
              </div>
            </div>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', meta.chip)}>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
