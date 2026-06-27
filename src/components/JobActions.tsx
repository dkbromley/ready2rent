'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { JobStatus } from '@prisma/client';
import { CheckCircle2, AlertTriangle, Play, CalendarCheck, Loader2 } from 'lucide-react';
import { updateJobStatus, saveJobNotes } from '@/server/actions';
import { JOB_NEXT_STATUSES, JOB_STATUS_META } from '@/lib/status';
import { Button, inputClass } from '@/components/ui';
import { cn } from '@/lib/utils';

const STATUS_ICON: Partial<Record<JobStatus, React.ReactNode>> = {
  SCHEDULED: <CalendarCheck className="h-4 w-4" />,
  IN_PROGRESS: <Play className="h-4 w-4" />,
  COMPLETED: <CheckCircle2 className="h-4 w-4" />,
  PROBLEM: <AlertTriangle className="h-4 w-4" />,
  NEEDS_SCHEDULING: <CalendarCheck className="h-4 w-4" />,
};

export function JobStatusActions({
  jobId,
  current,
}: {
  jobId: string;
  current: JobStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState('');
  const next = JOB_NEXT_STATUSES[current];

  function move(to: JobStatus) {
    startTransition(async () => {
      await updateJobStatus(jobId, to, note || undefined);
      setNote('');
      router.refresh();
    });
  }

  if (next.length === 0) {
    return <p className="text-sm text-navy-500">This job is {JOB_STATUS_META[current].label.toLowerCase()} — no further actions.</p>;
  }

  return (
    <div className="space-y-3">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for this status change…"
        className={inputClass}
      />
      <div className="flex flex-wrap gap-2">
        {next.map((to) => {
          const danger = to === JobStatus.PROBLEM;
          const success = to === JobStatus.COMPLETED;
          return (
            <button
              key={to}
              disabled={pending}
              onClick={() => move(to)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60',
                success && 'bg-status-completed text-white hover:opacity-90',
                danger && 'bg-status-problem text-white hover:opacity-90',
                !success && !danger && 'bg-white text-navy-800 ring-1 ring-inset ring-navy-200 hover:bg-navy-50',
              )}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : STATUS_ICON[to]}
              {JOB_STATUS_META[to].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function JobNotes({
  jobId,
  canEditOwner,
  canEditCleaner,
  ownerNotes,
  cleanerNotes,
}: {
  jobId: string;
  canEditOwner: boolean;
  canEditCleaner: boolean;
  ownerNotes: string | null;
  cleanerNotes: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      await saveJobNotes(formData);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="jobId" value={jobId} />
      {canEditOwner ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-navy-700">Owner notes</span>
          <textarea name="ownerNotes" rows={3} defaultValue={ownerNotes ?? ''} className={inputClass} />
        </label>
      ) : (
        ownerNotes && (
          <div>
            <p className="text-sm font-medium text-navy-700">Owner notes</p>
            <p className="mt-1 whitespace-pre-wrap rounded-xl bg-navy-50 p-3 text-sm text-navy-600">{ownerNotes}</p>
          </div>
        )
      )}

      {canEditCleaner ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-navy-700">Cleaner notes</span>
          <textarea name="cleanerNotes" rows={3} defaultValue={cleanerNotes ?? ''} className={inputClass} />
        </label>
      ) : (
        cleanerNotes && (
          <div>
            <p className="text-sm font-medium text-navy-700">Cleaner notes</p>
            <p className="mt-1 whitespace-pre-wrap rounded-xl bg-navy-50 p-3 text-sm text-navy-600">{cleanerNotes}</p>
          </div>
        )
      )}

      {(canEditOwner || canEditCleaner) && (
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? 'Saving…' : 'Save notes'}
          </Button>
          {saved && <span className="text-sm text-status-completed">Saved ✓</span>}
        </div>
      )}
    </form>
  );
}
