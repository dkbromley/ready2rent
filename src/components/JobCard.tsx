import Link from 'next/link';
import { LogOut, LogIn, MapPin, Timer } from 'lucide-react';
import type { JobStatus, JobPriority, JobType } from '@prisma/client';
import { JobStatusBadge, SameDayBadge } from '@/components/StatusBadge';
import { formatInTz } from '@/lib/datetime';
import { formatTurnoverWindow, JOB_TYPE_META } from '@/lib/status';
import { cn } from '@/lib/utils';

export interface JobCardData {
  id: string;
  status: JobStatus;
  priority: JobPriority;
  /** Manual kinds (one-off / move-out / deep clean) get a visible chip. */
  type?: JobType;
  checkoutDateTime: Date;
  nextCheckInDateTime: Date | null;
  sameDayTurnover: boolean;
  turnoverWindowMinutes: number | null;
  property: { name: string; city: string | null; state: string | null; timezone: string };
}

export function JobCard({ job, compact = false }: { job: JobCardData; compact?: boolean }) {
  const tz = job.property.timezone;
  return (
    <Link
      href={`/jobs/${job.id}`}
      className={cn(
        'card relative block overflow-hidden p-4 pl-5 transition hover:shadow-card-hover',
        job.sameDayTurnover && 'ring-1 ring-status-problem/30',
      )}
    >
      {/* Coastal accent bar — seafoam, or coral for same-day turnovers. */}
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b',
          job.sameDayTurnover ? 'from-coral-400 to-coral-600' : 'from-brand-400 to-brand-600',
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-900">{job.property.name}</p>
          {(job.property.city || job.property.state) && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-navy-400">
              <MapPin className="h-3 w-3" />
              {[job.property.city, job.property.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      <div className={cn('mt-3 grid gap-2 text-sm', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        <div className="flex items-center gap-2 text-navy-700">
          <LogOut className="h-4 w-4 text-status-problem" />
          <span className="font-medium">Out</span>
          <span className="text-navy-500">{formatInTz(job.checkoutDateTime, tz)}</span>
        </div>
        <div className="flex items-center gap-2 text-navy-700">
          <LogIn className="h-4 w-4 text-status-available" />
          <span className="font-medium">In</span>
          <span className="text-navy-500">
            {job.nextCheckInDateTime ? formatInTz(job.nextCheckInDateTime, tz) : '—'}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {job.type && job.type !== 'TURNOVER' && (
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', JOB_TYPE_META[job.type].chip)}>
            {JOB_TYPE_META[job.type].label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy-600">
          <Timer className="h-3 w-3" />
          {formatTurnoverWindow(job.turnoverWindowMinutes)}
        </span>
        {job.sameDayTurnover && <SameDayBadge />}
      </div>
    </Link>
  );
}
