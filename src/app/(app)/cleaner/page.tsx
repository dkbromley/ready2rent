import Link from 'next/link';
import { Plus, CalendarDays, Sun, CalendarPlus, AlertTriangle, Wallet } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { JobStatus, UserRole } from '@prisma/client';
import { getCleanerDashboard } from '@/server/queries';
import { getOutstandingForUser } from '@/server/financials';
import { formatMoney } from '@/lib/money';
import { StatTile, SectionTitle, EmptyState, Card, LinkButton } from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { WeeklyChart } from '@/components/WeeklyChart';
import { ActivityFeed } from '@/components/ActivityFeed';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { TodayTimeline } from '@/components/dashboard/TodayTimeline';
import { AttentionCard, type AttentionItem } from '@/components/dashboard/AttentionCard';
import { formatInTz } from '@/lib/datetime';

export default async function CleanerDashboardPage() {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const [d, owed] = await Promise.all([getCleanerDashboard(user), getOutstandingForUser(user)]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const attention: AttentionItem[] = [
    ...d.problems.map((j) => ({
      id: `problem-${j.id}`,
      severity: 'high' as const,
      title: `Problem reported — ${j.property.name}`,
      detail: formatInTz(j.checkoutDateTime, j.property.timezone),
      href: `/jobs/${j.id}`,
    })),
    ...(owed > 0
      ? [
          {
            id: 'owed',
            severity: 'medium' as const,
            title: `You're owed ${formatMoney(owed)}`,
            detail: 'Track payments in Financials',
            href: '/financials',
          },
        ]
      : []),
  ];

  const totalToday = d.todaysAll.length;
  const doneToday = d.todaysAll.filter((j) => j.status === JobStatus.COMPLETED).length;
  const sameDayToday = d.todaysAll.filter((j) => j.sameDayTurnover).length;

  const firstUp = d.todays[0];
  const nextUp = d.thisWeek[0];
  const summary =
    totalToday === 0
      ? nextUp
        ? `Nothing due today. Next clean: ${nextUp.property.name}, ${formatInTz(nextUp.checkoutDateTime, nextUp.property.timezone)}.`
        : 'Nothing due today. New turnovers land here as soon as a calendar syncs.'
      : [
          `${totalToday} clean${totalToday === 1 ? '' : 's'} today`,
          sameDayToday > 0 ? `${sameDayToday} same-day` : null,
          doneToday > 0 ? `${doneToday} done` : null,
          firstUp
            ? `next checkout ${formatInTz(firstUp.checkoutDateTime, firstUp.property.timezone, 'h:mm a')} at ${firstUp.property.name}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') + '.';

  return (
    <div>
      <DashboardHero
        name={user.name}
        dateLabel={today}
        summary={summary}
        doneToday={doneToday}
        totalToday={totalToday}
        actions={
          <>
            <LinkButton href="/cleaner/calendar">
              <CalendarDays className="h-4 w-4" /> Calendar
            </LinkButton>
            <Link
              href="/cleaner/jobs/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/10"
            >
              <Plus className="h-4 w-4" /> New job
            </Link>
            <Link
              href="/cleaner/properties/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/10"
            >
              <Plus className="h-4 w-4" /> Add property
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile icon={<Sun className="h-5 w-5" />} tone="teal" label="Today" value={totalToday} />
        <StatTile icon={<CalendarPlus className="h-5 w-5" />} tone="neutral" label="Tomorrow" value={d.tomorrows.length} />
        <StatTile icon={<AlertTriangle className="h-5 w-5" />} tone="coral" label="Same-day" value={d.sameDay.length} />
        <StatTile icon={<Wallet className="h-5 w-5" />} tone="amber" label="You're owed" value={formatMoney(owed)} href="/financials" />
      </div>

      <div className="mt-6">
        <TodayTimeline jobs={d.todaysAll} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
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
          <AttentionCard items={attention} />

          <Card>
            <SectionTitle>Turnovers this week</SectionTitle>
            <WeeklyChart data={d.weekly} />
          </Card>

          <Card>
            <SectionTitle>Recent activity</SectionTitle>
            <ActivityFeed items={d.activity} />
          </Card>
        </div>
      </div>
    </div>
  );
}
