import Link from 'next/link';
import { redirect } from 'next/navigation';
import { JobStatus, UserRole } from '@prisma/client';
import { AlertTriangle, ArrowRight, Plus, Play, CircleCheck, Building2, Wallet } from 'lucide-react';
import { requireUser } from '@/lib/rbac';
import { getOwnerDashboard, getUserTimezone } from '@/server/queries';
import { getOutstandingForUser } from '@/server/financials';
import { getOwnerOnboarding } from '@/server/onboarding';
import { greetingForHour } from '@/components/dashboard/DashboardGreeting';
import { toZonedTime } from 'date-fns-tz';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { formatMoney } from '@/lib/money';
import { PageHeader, StatTile, SectionTitle, EmptyState, LinkButton, Card } from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { WeeklyChart } from '@/components/WeeklyChart';
import { ActivityFeed } from '@/components/ActivityFeed';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { TodayTimeline } from '@/components/dashboard/TodayTimeline';
import { AttentionCard, type AttentionItem } from '@/components/dashboard/AttentionCard';
import { formatInTz } from '@/lib/datetime';

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === UserRole.CLEANER) redirect('/cleaner');

  const tz = await getUserTimezone(user.id);
  const [d, outstanding, onboarding] = await Promise.all([
    getOwnerDashboard(user, tz),
    getOutstandingForUser(user),
    getOwnerOnboarding(user),
  ]);

  // Server fallbacks in the user's saved timezone; the hero refines to the
  // exact device clock client-side.
  const today = formatInTz(new Date(), tz, 'EEEE, MMMM d');
  const greeting = greetingForHour(toZonedTime(new Date(), tz).getHours());

  // One triage list instead of scattered banners.
  const attention: AttentionItem[] = [
    ...d.syncErrors.map((f) => ({
      id: `sync-${f.id}`,
      severity: 'high' as const,
      title: `Calendar sync failed — ${f.property.name}`,
      detail: f.lastSyncError ?? 'Unknown error',
      href: `/properties/${f.propertyId}`,
    })),
    ...d.problemJobs.map((j) => ({
      id: `problem-${j.id}`,
      severity: 'high' as const,
      title: `Problem reported — ${j.property.name}`,
      detail: formatInTz(j.checkoutDateTime, j.property.timezone),
      href: `/jobs/${j.id}`,
    })),
    ...d.needingAssignment.map((p) => ({
      id: `assign-${p.id}`,
      severity: 'medium' as const,
      title: `No cleaner assigned — ${p.name}`,
      detail: 'Turnovers here have nobody to do them yet',
      href: `/properties/${p.id}`,
    })),
    ...(outstanding > 0
      ? [
          {
            id: 'outstanding',
            severity: 'medium' as const,
            title: `${formatMoney(outstanding)} in payments outstanding`,
            detail: 'Review and settle up in Financials',
            href: '/financials',
          },
        ]
      : []),
  ];

  const totalToday = d.todaysJobs.length;
  const doneToday = d.todaysJobs.filter((j) => j.status === JobStatus.COMPLETED).length;
  const sameDayToday = d.todaysJobs.filter((j) => j.sameDayTurnover).length;

  const next = d.upcomingCheckouts[0];
  const summary =
    totalToday === 0
      ? next
        ? `Nothing on the schedule today. Next turnover: ${next.property.name}, ${formatInTz(next.checkoutDateTime, next.property.timezone)}.`
        : 'Nothing on the schedule today. New reservations appear here automatically after every sync.'
      : [
          `${totalToday} turnover${totalToday === 1 ? '' : 's'} on the books today`,
          sameDayToday > 0 ? `${sameDayToday} same-day` : null,
          doneToday > 0 ? `${doneToday} already done` : null,
          attention.length > 0
            ? `${attention.length} item${attention.length === 1 ? '' : 's'} need${attention.length === 1 ? 's' : ''} your attention`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') + '.';

  return (
    <div>
      {onboarding.complete ? (
        <DashboardHero
          name={user.name}
          dateLabel={today}
          greeting={greeting}
          summary={summary}
          doneToday={doneToday}
          totalToday={totalToday}
          actions={
            <>
              <LinkButton href="/properties/new">
                <Plus className="h-4 w-4" /> Add property
              </LinkButton>
              <Link
                href="/jobs"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/10"
              >
                View turnovers <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          }
        />
      ) : (
        <>
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
        </>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile icon={<Building2 className="h-5 w-5" />} tone="teal" label="Properties" value={d.propertyCount} href="/properties" />
        <StatTile icon={<AlertTriangle className="h-5 w-5" />} tone="coral" label="Same-day" value={d.sameDayTurnovers.length} />
        <StatTile icon={<Play className="h-5 w-5" />} tone="neutral" label="In progress" value={d.inProgress} />
        <StatTile icon={<CircleCheck className="h-5 w-5" />} tone="green" label="Done today" value={doneToday} />
        <StatTile icon={<Wallet className="h-5 w-5" />} tone="amber" label="Outstanding" value={formatMoney(outstanding)} href="/financials" />
      </div>

      <div className="mt-6">
        <TodayTimeline jobs={d.todaysJobs} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
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
        </section>

        <div className="space-y-6">
          <AttentionCard items={attention} />

          <Card>
            <SectionTitle>Turnovers this week</SectionTitle>
            <WeeklyChart data={d.weekly} />
          </Card>

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
