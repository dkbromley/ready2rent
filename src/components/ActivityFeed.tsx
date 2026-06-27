import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { CircleCheck, AlertTriangle, Play, CalendarClock, CalendarX, Clock } from 'lucide-react';
import { JobStatus } from '@prisma/client';
import { JOB_STATUS_META } from '@/lib/status';
import type { ActivityItem } from '@/server/queries';
import { cn } from '@/lib/utils';

const ICON: Record<JobStatus, { icon: React.ReactNode; tint: string }> = {
  COMPLETED: { icon: <CircleCheck className="h-4 w-4" />, tint: 'bg-teal-50 text-status-completed' },
  PROBLEM: { icon: <AlertTriangle className="h-4 w-4" />, tint: 'bg-coral-50 text-coral-600' },
  IN_PROGRESS: { icon: <Play className="h-4 w-4" />, tint: 'bg-violet-50 text-status-progress' },
  SCHEDULED: { icon: <CalendarClock className="h-4 w-4" />, tint: 'bg-blue-50 text-status-scheduled' },
  NEEDS_SCHEDULING: { icon: <Clock className="h-4 w-4" />, tint: 'bg-amber-50 text-amber-700' },
  CANCELED: { icon: <CalendarX className="h-4 w-4" />, tint: 'bg-navy-100 text-navy-500' },
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-navy-500">No recent activity.</p>;
  }
  return (
    <div>
      {items.map((a) => {
        const m = ICON[a.toStatus];
        return (
          <Link
            key={a.id}
            href={`/jobs/${a.jobId}`}
            className="flex items-center gap-3 border-t border-navy-50 py-2.5 first:border-t-0"
          >
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', m.tint)}>{m.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-navy-800">
                {a.propertyName} · {JOB_STATUS_META[a.toStatus].label.toLowerCase()}
              </p>
              <p className="text-xs text-navy-400">{formatDistanceToNow(a.createdAt, { addSuffix: true })}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
