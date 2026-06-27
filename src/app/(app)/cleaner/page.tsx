import { Plus, CalendarDays, Sun, CalendarPlus, AlertTriangle, Wrench } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { UserRole } from '@prisma/client';
import { getCleanerDashboard } from '@/server/queries';
import { PageHeader, StatTile, SectionTitle, EmptyState, Card, LinkButton } from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { WeeklyChart } from '@/components/WeeklyChart';
import { ActivityFeed } from '@/components/ActivityFeed';

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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile icon={<Sun className="h-5 w-5" />} tone="teal" label="Today" value={d.todays.length} />
        <StatTile icon={<CalendarPlus className="h-5 w-5" />} tone="neutral" label="Tomorrow" value={d.tomorrows.length} />
        <StatTile icon={<AlertTriangle className="h-5 w-5" />} tone="coral" label="Same-day" value={d.sameDay.length} />
        <StatTile icon={<Wrench className="h-5 w-5" />} tone="amber" label="Problems" value={d.problems.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div>
            <SectionTitle>Today</SectionTitle>
            {d.todays.length === 0 ? (
              <EmptyState title="Nothing due today" description="Enjoy the breather — tomorrow's jobs are below." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.todays.map((job) => <JobCard key={job.id} job={job} compact />)}
              </div>
            )}
          </div>

          <div>
            <SectionTitle>Tomorrow</SectionTitle>
            {d.tomorrows.length === 0 ? (
              <Card className="text-sm text-navy-500">No turnovers scheduled for tomorrow.</Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.tomorrows.map((job) => <JobCard key={job.id} job={job} compact />)}
              </div>
            )}
          </div>

          <div>
            <SectionTitle action={<span className="text-xs text-navy-400">{d.thisWeek.length} jobs</span>}>This week</SectionTitle>
            {d.thisWeek.length === 0 ? (
              <Card className="text-sm text-navy-500">No turnovers in the next 7 days.</Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.thisWeek.map((job) => <JobCard key={job.id} job={job} compact />)}
              </div>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <Card>
            <SectionTitle>Turnovers this week</SectionTitle>
            <WeeklyChart data={d.weekly} />
          </Card>

          {d.problems.length > 0 && (
            <div>
              <SectionTitle>Needs attention</SectionTitle>
              <div className="space-y-3">
                {d.problems.map((job) => <JobCard key={job.id} job={job} compact />)}
              </div>
            </div>
          )}

          <Card>
            <SectionTitle>Recent activity</SectionTitle>
            <ActivityFeed items={d.activity} />
          </Card>
        </div>
      </div>
    </div>
  );
}
