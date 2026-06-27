import { requireUser } from '@/lib/rbac';
import { getArchivedJobs } from '@/server/queries';
import { PageHeader, EmptyState, Card } from '@/components/ui';
import { JobCard, type JobCardData } from '@/components/JobCard';
import { ARCHIVE_AFTER_DAYS } from '@/lib/limits';
import { formatInTz } from '@/lib/datetime';

export default async function ArchivePage() {
  const user = await requireUser();
  const jobs = await getArchivedJobs(user);

  return (
    <div>
      <PageHeader
        title="Archive"
        subtitle={`Completed turnovers. Kept for ${ARCHIVE_AFTER_DAYS} days, then automatically cleared to save space.`}
      />

      <Card className="mb-6 bg-navy-50/60 text-sm text-navy-600">
        Completed jobs stay here for {ARCHIVE_AFTER_DAYS} days. After that, photos are removed to reclaim
        storage — but the job records are kept permanently, so your analytics and history are never affected.
      </Card>

      {jobs.length === 0 ? (
        <EmptyState
          title="Nothing in the archive yet"
          description="When a turnover is marked complete, it moves here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <div key={job.id}>
              <JobCard job={job as unknown as JobCardData} compact />
              <p className="mt-1 px-1 text-xs text-navy-400">
                Completed {job.completedAt ? formatInTz(job.completedAt, job.property.timezone, 'MMM d, h:mm a') : '—'}
                {job._count.photos > 0 ? ` · ${job._count.photos} photo${job._count.photos === 1 ? '' : 's'}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
