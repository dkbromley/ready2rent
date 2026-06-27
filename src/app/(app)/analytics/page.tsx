import { UserRole } from '@prisma/client';
import { CircleCheck, Percent, Timer, CalendarCheck, AlertTriangle, Wrench } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { getOwnerAnalytics } from '@/server/analytics';
import { PageHeader, StatTile, Card, SectionTitle, EmptyState } from '@/components/ui';
import { TrendChart, BarList } from '@/components/AnalyticsCharts';
import { formatMinutes } from '@/lib/status';

export default async function OwnerAnalyticsPage() {
  const user = await requireRole(UserRole.OWNER, UserRole.ADMIN);
  const a = await getOwnerAnalytics(user, 30);

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Turnover performance — last 30 days" />

      {a.totalDue === 0 ? (
        <EmptyState
          title="No turnover history yet"
          description="Once turnovers start completing, your completion rate, turnaround times, and trends show up here."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatTile icon={<CircleCheck className="h-5 w-5" />} tone="green" label="Completed" value={a.completed} />
            <StatTile icon={<Percent className="h-5 w-5" />} tone="teal" label="Completion" value={`${a.completionRate}%`} />
            <StatTile icon={<Timer className="h-5 w-5" />} tone="neutral" label="Avg turnaround" value={formatMinutes(a.avgTurnaroundMin)} />
            <StatTile icon={<CalendarCheck className="h-5 w-5" />} tone="teal" label="On-time" value={a.onTimeRate == null ? '—' : `${a.onTimeRate}%`} />
            <StatTile icon={<AlertTriangle className="h-5 w-5" />} tone="coral" label="Same-day" value={a.sameDay} />
            <StatTile icon={<Wrench className="h-5 w-5" />} tone="amber" label="Problems" value={a.problems} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle>Completed per week</SectionTitle>
              <TrendChart data={a.weekly} />
            </Card>
            <Card>
              <SectionTitle>By property</SectionTitle>
              <BarList rows={a.perProperty.map((p) => ({ label: p.name, value: p.completed, sub: `of ${p.total}` }))} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
