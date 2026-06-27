import { JobStatus, ReservationStatus, JobPriority, SyncStatus } from '@prisma/client';

/** Display metadata for job/reservation/sync states — single source of truth. */

export const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; dot: string; chip: string }
> = {
  NEEDS_SCHEDULING: {
    label: 'Needs scheduling',
    dot: 'bg-status-pending',
    chip: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  SCHEDULED: {
    label: 'Scheduled',
    dot: 'bg-status-scheduled',
    chip: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  },
  IN_PROGRESS: {
    label: 'In progress',
    dot: 'bg-status-progress',
    chip: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  },
  COMPLETED: {
    label: 'Completed',
    dot: 'bg-status-completed',
    chip: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  },
  PROBLEM: {
    label: 'Problem',
    dot: 'bg-status-problem',
    chip: 'bg-red-50 text-red-700 ring-red-600/20',
  },
  CANCELED: {
    label: 'Canceled',
    dot: 'bg-status-canceled',
    chip: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  },
};

export const RESERVATION_STATUS_META: Record<
  ReservationStatus,
  { label: string; chip: string }
> = {
  ACTIVE: { label: 'Active', chip: 'bg-teal-50 text-teal-700 ring-teal-600/20' },
  CHANGED: { label: 'Changed', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  POSSIBLY_CANCELED: {
    label: 'Possibly canceled',
    chip: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  },
  CANCELED: { label: 'Canceled', chip: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
};

export const PRIORITY_META: Record<JobPriority, { label: string; chip: string }> = {
  LOW: { label: 'Low', chip: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  NORMAL: { label: 'Normal', chip: 'bg-navy-100 text-navy-700 ring-navy-600/20' },
  HIGH: { label: 'High', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  URGENT: { label: 'Urgent', chip: 'bg-red-50 text-red-700 ring-red-600/20' },
};

export const SYNC_STATUS_META: Record<SyncStatus, { label: string; chip: string }> = {
  RUNNING: { label: 'Running', chip: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  SUCCESS: { label: 'Success', chip: 'bg-teal-50 text-teal-700 ring-teal-600/20' },
  PARTIAL: { label: 'Partial', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  FAILED: { label: 'Failed', chip: 'bg-red-50 text-red-700 ring-red-600/20' },
};

/** Allowed forward transitions a cleaner can apply from a given status. */
export const JOB_NEXT_STATUSES: Record<JobStatus, JobStatus[]> = {
  NEEDS_SCHEDULING: [JobStatus.SCHEDULED, JobStatus.IN_PROGRESS, JobStatus.PROBLEM],
  SCHEDULED: [JobStatus.IN_PROGRESS, JobStatus.PROBLEM, JobStatus.NEEDS_SCHEDULING],
  IN_PROGRESS: [JobStatus.COMPLETED, JobStatus.PROBLEM],
  COMPLETED: [],
  PROBLEM: [JobStatus.SCHEDULED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED],
  CANCELED: [],
};

export function formatTurnoverWindow(minutes: number | null): string {
  if (minutes == null) return 'No next guest';
  if (minutes < 0) return 'Overlap (check dates)';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m window`;
  if (m === 0) return `${h}h window`;
  return `${h}h ${m}m window`;
}
