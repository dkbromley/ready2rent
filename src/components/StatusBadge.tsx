import { JobStatus, ReservationStatus, SyncStatus, JobPriority } from '@prisma/client';
import { Chip } from '@/components/ui';
import {
  JOB_STATUS_META,
  RESERVATION_STATUS_META,
  SYNC_STATUS_META,
  PRIORITY_META,
} from '@/lib/status';

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = JOB_STATUS_META[status];
  return (
    <Chip className={meta.chip}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Chip>
  );
}

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const meta = RESERVATION_STATUS_META[status];
  return <Chip className={meta.chip}>{meta.label}</Chip>;
}

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const meta = SYNC_STATUS_META[status];
  return <Chip className={meta.chip}>{meta.label}</Chip>;
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const meta = PRIORITY_META[priority];
  return <Chip className={meta.chip}>{meta.label}</Chip>;
}

export function SameDayBadge() {
  return (
    <Chip className="bg-coral-50 text-coral-700 ring-coral-600/20">
      <span className="h-1.5 w-1.5 rounded-full bg-coral-500" />
      Same-day turnover
    </Chip>
  );
}
