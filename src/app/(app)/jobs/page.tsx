import { requireRole } from '@/lib/rbac';
import { UserRole } from '@prisma/client';
import { listOwnerJobs } from '@/server/queries';
import { PageHeader, EmptyState, LinkButton } from '@/components/ui';
import { JobCard, type JobCardData } from '@/components/JobCard';
import { localDayKey, formatInTz } from '@/lib/datetime';
import { Plus } from 'lucide-react';

export default async function JobsPage() {
  const user = await requireRole(UserRole.OWNER, UserRole.ADMIN);
  const jobs = await listOwnerJobs(user);

  // Group by checkout local-day for a calendar-style list.
  const groups = new Map<string, { label: string; jobs: typeof jobs }>();
  for (const job of jobs) {
    const tz = job.property.timezone;
    const key = localDayKey(job.checkoutDateTime, tz);
    if (!groups.has(key)) {
      groups.set(key, { label: formatInTz(job.checkoutDateTime, tz, 'EEEE, MMMM d, yyyy'), jobs: [] });
    }
    groups.get(key)!.jobs.push(job);
  }
  const sortedKeys = [...groups.keys()].sort();

  return (
    <div>
      <PageHeader
        title="Turnovers"
        subtitle="Every cleaning job generated from your reservations."
        action={
          <LinkButton href="/properties/new">
            <Plus className="h-4 w-4" /> Add property
          </LinkButton>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          title="No turnover jobs yet"
          description="Connect a calendar to a property and jobs will appear here, grouped by checkout day."
          action={<LinkButton href="/properties" variant="secondary">Go to properties</LinkButton>}
        />
      ) : (
        <div className="space-y-8">
          {sortedKeys.map((key) => {
            const group = groups.get(key)!;
            return (
              <section key={key}>
                <h2 className="mb-3 text-sm font-semibold text-navy-700">{group.label}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.jobs.map((job) => (
                    <JobCard key={job.id} job={job as unknown as JobCardData} compact />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
