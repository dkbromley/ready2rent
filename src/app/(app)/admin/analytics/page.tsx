import { UserRole } from '@prisma/client';
import { Users, Home, Building2, CalendarRange, ClipboardList, Percent, Timer, AlertTriangle } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { getPlatformAnalytics } from '@/server/analytics';
import { PageHeader, StatTile, Card, SectionTitle } from '@/components/ui';
import { TrendChart, BarList } from '@/components/AnalyticsCharts';
import { JOB_STATUS_META, formatMinutes } from '@/lib/status';

export default async function AdminAnalyticsPage() {
  await requireRole(UserRole.ADMIN);
  const a = await getPlatformAnalytics(30);
  const t = a.turnover;
  const syncRate = a.sync.total > 0 ? Math.round((a.sync.success / a.sync.total) * 100) : 0;

  return (
    <div>
      <PageHeader title="Platform analytics" subtitle="Across all accounts — turnovers over the last 30 days" />

      <SectionTitle>Platform</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={<Users className="h-5 w-5" />} tone="teal" label="Users" value={a.totals.users} />
        <StatTile icon={<Home className="h-5 w-5" />} tone="neutral" label="Hosts" value={a.totals.owners} />
        <StatTile icon={<Users className="h-5 w-5" />} tone="neutral" label="Cleaners" value={a.totals.cleaners} />
        <StatTile icon={<Building2 className="h-5 w-5" />} tone="teal" label="Properties" value={a.totals.properties} />
        <StatTile icon={<CalendarRange className="h-5 w-5" />} tone="neutral" label="Reservations" value={a.totals.reservations} />
        <StatTile icon={<ClipboardList className="h-5 w-5" />} tone="neutral" label="Turnover jobs" value={a.totals.jobs} />
      </div>

      <div className="mt-8">
        <SectionTitle>Turnovers (30 days)</SectionTitle>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile icon={<Percent className="h-5 w-5" />} tone="teal" label="Completion" value={`${t.completionRate}%`} />
        <StatTile icon={<Timer className="h-5 w-5" />} tone="neutral" label="Avg turnaround" value={formatMinutes(t.avgTurnaroundMin)} />
        <StatTile icon={<AlertTriangle className="h-5 w-5" />} tone="coral" label="Same-day" value={t.sameDay} />
        <StatTile icon={<Percent className="h-5 w-5" />} tone="green" label="Feed sync health" value={`${syncRate}%`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Completed per week</SectionTitle>
          <TrendChart data={t.weekly} />
        </Card>
        <Card>
          <SectionTitle>Jobs by status (all time)</SectionTitle>
          <BarList
            rows={a.statusDistribution.map((s) => ({
              label: JOB_STATUS_META[s.status].label,
              value: s.count,
              tone: s.status === 'PROBLEM' ? 'coral' : s.status === 'CANCELED' ? 'navy' : 'teal',
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
