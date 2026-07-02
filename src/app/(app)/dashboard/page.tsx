import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { AlertTriangle, Home, Plus, Play, CircleCheck, Building2, Wallet } from 'lucide-react';
import { requireUser } from '@/lib/rbac';
import { getOwnerDashboard } from '@/server/queries';
import { getOutstandingForUser } from '@/server/financials';
import { getOwnerOnboarding } from '@/server/onboarding';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { formatMoney } from '@/lib/money';
import { PageHeader, StatTile, SectionTitle, EmptyState, LinkButton, Card } from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { WeeklyChart } from '@/components/WeeklyChart';
import { ActivityFeed } from '@/components/ActivityFeed';
import { SameDayBadge } from '@/components/StatusBadge';
import { formatInTz } from '@/lib/datetime';

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === UserRole.CLEANER) redirect('/cleaner');

  const [d, outstanding, onboarding] = await Promise.all([
    getOwnerDashboard(user),
    getOutstandingForUser(user),
    getOwnerOnboarding(user),
  ]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div>
      <PageHeader
        eyebrow={`Today · ${today}`}
        title="Dashboard"
        subtitle="Your turnover operations at a glance."
        action={
          <LinkButton href="/properties/new">
            <Plus className="h-4 w-4" /> Add property
          </LinkButton>
        }
      />

      <OnboardingChecklist state={onboarding} />

      {d.syncErrors.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-coral-200 bg-coral-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-coral-600" />
          <div className="text-sm">
            <p className="font-semibold text-coral-800">
              {d.syncErrors.length} calendar feed{d.syncErrors.length > 1 ? 's' : ''} failed to sync
            </p>
            <ul className="mt-1 space-y-0.5 text-coral-700">
              {d.syncErrors.map((f) => (
                <li key={f.id}>
                  <Link href={`/properties/${f.propertyId}`} className="underline">{f.property.name}</Link>{' '}
                  — {f.lastSyncError ?? 'Unknown error'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile icon={<Building2 className="h-5 w-5" />} tone="teal" label="Properties" value={d.propertyCount} href="/properties" />
        <StatTile icon={<AlertTriangle className="h-5 w-5" />} tone="coral" label="Same-day" value={d.sameDayTurnovers.length} />
        <StatTile icon={<Play className="h-5 w-5" />} tone="neutral" label="In progress" value={d.inProgress} />
        <StatTile icon={<CircleCheck className="h-5 w-5" />} tone="green" label="Done today" value={d.completedToday} />
        <StatTile icon={<Wallet className="h-5 w-5" />} tone="amber" label="Outstanding" value={formatMoney(outstanding)} href="/financials" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle action={<Link href="/jobs" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>}>
            Upcoming checkouts
          </SectionTitle>
          {d.upcomingCheckouts.length === 0 ? (
            <EmptyState
              title="No upcoming turnovers"
              description="Connect a calendar to a property and reservations appear here automatically."
              action={<LinkButton href="/properties" variant="secondary">Go to properties</LinkButton>}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {d.upcomingCheckouts.map((job) => (
                <JobCard key={job.id} job={job} compact />
              ))}
            </div>
          )}

          {d.needingAssignment.length > 0 && (
            <div className="mt-6">
              <SectionTitle>Needs a cleaner</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                {d.needingAssignment.map((p) => (
                  <Link key={p.id} href={`/properties/${p.id}`} className="card flex items-center gap-3 p-3 hover:shadow-card-hover">
                    <Home className="h-4 w-4 text-navy-400" />
                    <span className="flex-1 truncate text-sm font-medium text-navy-900">{p.name}</span>
                    <span className="text-xs font-medium text-brand-700">Assign →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <Card>
            <SectionTitle>Turnovers this week</SectionTitle>
            <WeeklyChart data={d.weekly} />
          </Card>

          {d.sameDayTurnovers.length > 0 && (
            <Card>
              <SectionTitle>Same-day turnovers</SectionTitle>
              <div className="space-y-2">
                {d.sameDayTurnovers.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-xl ring-1 ring-coral-500/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-navy-900">{job.property.name}</span>
                      <SameDayBadge />
                    </div>
                    <p className="mt-1 text-xs text-navy-500">{formatInTz(job.checkoutDateTime, job.property.timezone)}</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle action={<Link href="/jobs" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>}>
              Recent activity
            </SectionTitle>
            <ActivityFeed items={d.activity} />
          </Card>
        </div>
      </div>
    </div>
  );
}
