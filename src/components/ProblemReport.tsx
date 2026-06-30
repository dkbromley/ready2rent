'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { reportJobProblem } from '@/server/actions';
import { JobPhotos, type JobPhotoItem } from '@/components/JobPhotos';
import { inputClass } from '@/components/ui';

/**
 * Cleaner-facing problem reporter: describe the issue, attach photos (stored as
 * PROBLEM-kind), and flag the job. Hosts see the description + photos read-only.
 */
export function ProblemReport({
  jobId,
  canReport,
  problemNote,
  photos,
}: {
  jobId: string;
  canReport: boolean;
  problemNote: string | null;
  photos: JobPhotoItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      await reportJobProblem(formData);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  }

  // Read-only view for hosts (or when there's nothing to add).
  if (!canReport) {
    if (!problemNote && photos.length === 0) {
      return <p className="text-sm text-navy-500">No problems reported.</p>;
    }
    return (
      <div className="space-y-3">
        {problemNote && (
          <div className="rounded-xl border border-coral-200 bg-coral-50 p-3 text-sm text-coral-800">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-4 w-4" /> Problem reported
            </p>
            <p className="whitespace-pre-wrap">{problemNote}</p>
          </div>
        )}
        {photos.length > 0 && <JobPhotos jobId={jobId} photos={photos} canManage={false} kind="PROBLEM" />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {problemNote && (
        <div className="rounded-xl border border-coral-200 bg-coral-50 p-3 text-sm text-coral-800">
          <p className="mb-1 font-medium">Currently reported</p>
          <p className="whitespace-pre-wrap">{problemNote}</p>
        </div>
      )}

      <form action={onSubmit} className="space-y-3">
        <input type="hidden" name="jobId" value={jobId} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-navy-700">Describe the issue</span>
          <textarea
            name="details"
            rows={3}
            defaultValue={problemNote ?? ''}
            placeholder="e.g. Broken lamp in the master bedroom; stain on the couch."
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-status-problem px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Report problem &amp; notify host
          </button>
          {saved && <span className="text-sm text-status-completed">Host notified ✓</span>}
        </div>
      </form>

      {/* Photo evidence — uploaded immediately, independent of the form above. */}
      <div>
        <p className="mb-2 text-sm font-medium text-navy-700">Photos of the issue</p>
        <JobPhotos jobId={jobId} photos={photos} canManage kind="PROBLEM" />
      </div>
    </div>
  );
}
