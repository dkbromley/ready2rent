import { Map, Plus, CalendarDays } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { UserRole } from '@prisma/client';
import { getCleanerDashboard } from '@/server/queries';
import { PageHeader, StatCard, SectionTitle, EmptyState, Card, LinkButton } from '@/components/ui';
import { JobCard } from '@/components/JobCard';

export default async function CleanerDashboardPage() {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const d = await getCleanerDashboard(user);

  return (
    <div>
      <PageHeader
        title="My jobs"
        subtitle="Your turnover schedule, kept in sync automatically."
        action={
          <div className="flex gap-2">
            <LinkButton href="/cleaner/calendar" variant="secondary"><CalendarDays className="h-4 w-4" /> Calendar</LinkButton>
            <LinkButton href="/cleaner/properties/new"><Plus className="h-4 w-4" /> Add property</LinkButton>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today" value={d.todays.length} />
        <StatCard label="Tomorrow" value={d.tomorrows.length} />
        <StatCard
          label="Same-day turnovers"
          value={d.sameDay.length}
          accent={d.sameDay.length > 0 ? 'text-status-problem' : undefined}
        />
        <StatCard
          label="Problems"
          value={d.problems.length}
          accent={d.problems.length > 0 ? 'text-status-problem' : undefined}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-8">
          <div>
            <SectionTitle>Today</SectionTitle>
            {d.todays.length === 0 ? (
              <EmptyState title="Nothing due today" description="Enjoy the breather — tomorrow's jobs are below." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.todays.map((job) => (
                  <JobCard key={job.id} job={job} compact />
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionTitle>Tomorrow</SectionTitle>
            {d.tomorrows.length === 0 ? (
              <Card className="text-sm text-navy-500">No turnovers scheduled for tomorrow.</Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.tomorrows.map((job) => (
                  <JobCard key={job.id} job={job} compact />
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionTitle>This week</SectionTitle>
            {d.thisWeek.length === 0 ? (
              <Card className="text-sm text-navy-500">No turnovers in the next 7 days.</Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.thisWeek.map((job) => (
                  <JobCard key={job.id} job={job} compact />
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="space-y-8">
          {d.problems.length > 0 && (
            <section>
              <SectionTitle>Needs attention</SectionTitle>
              <div className="space-y-3">
                {d.problems.map((job) => (
                  <JobCard key={job.id} job={job} compact />
                ))}
              </div>
            </section>
          )}

          {d.sameDay.length > 0 && (
            <section>
              <SectionTitle>Same-day turnovers</SectionTitle>
              <div className="space-y-3">
                {d.sameDay.map((job) => (
                  <JobCard key={job.id} job={job} compact />
                ))}
              </div>
            </section>
          )}

          {/* Routing placeholder (Phase 5). */}
          <section>
            <SectionTitle>Route</SectionTitle>
            <Card className="flex flex-col items-center gap-2 py-8 text-center text-navy-400">
              <Map className="h-8 w-8" />
              <p className="text-sm">Map &amp; route optimization coming soon.</p>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
