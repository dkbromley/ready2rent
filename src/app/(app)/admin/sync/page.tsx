import Link from 'next/link';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SyncStatus, UserRole } from '@prisma/client';
import { requireRole } from '@/lib/rbac';
import { getAdminSyncHealth } from '@/server/queries';
import { triggerAllSync, triggerFeedSync } from '@/server/actions';
import { PageHeader, Card, Button, StatCard, SectionTitle } from '@/components/ui';
import { SyncStatusBadge } from '@/components/StatusBadge';
import { formatInTz } from '@/lib/datetime';

export default async function AdminSyncPage() {
  await requireRole(UserRole.ADMIN);
  const { feeds, recentLogs, failedLogs, totals } = await getAdminSyncHealth();

  const countBy = (s: SyncStatus | null) =>
    totals.find((t) => t.lastSyncStatus === s)?._count ?? 0;
  const failing = countBy(SyncStatus.FAILED);

  return (
    <div>
      <PageHeader
        title="Calendar sync health"
        subtitle="Monitor feed ingestion across the platform."
        action={
          <form action={triggerAllSync}>
            <Button type="submit"><RefreshCw className="h-4 w-4" /> Sync all feeds</Button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total feeds" value={feeds.length} />
        <StatCard label="Healthy" value={countBy(SyncStatus.SUCCESS)} accent="text-status-completed" />
        <StatCard label="Failing" value={failing} accent={failing > 0 ? 'text-status-problem' : undefined} />
        <StatCard label="Never synced" value={countBy(null)} accent="text-navy-400" />
      </div>

      {/* Failed imports */}
      <section className="mt-8">
        <SectionTitle>Failed imports</SectionTitle>
        {failedLogs.length === 0 ? (
          <Card className="flex items-center gap-2 text-sm text-status-completed">
            <CheckCircle2 className="h-4 w-4" /> No recent failures. All feeds healthy.
          </Card>
        ) : (
          <Card className="space-y-3">
            {failedLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 border-b border-navy-50 pb-3 last:border-0 last:pb-0">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-problem" />
                <div className="text-sm">
                  <p className="font-medium text-navy-800">{log.property?.name ?? 'Unknown property'}</p>
                  <p className="text-status-problem">{log.errorDetail ?? log.message}</p>
                  <p className="text-xs text-navy-400">{formatInTz(log.startedAt, 'UTC', 'MMM d, h:mm a')} UTC</p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Feeds table */}
      <section className="mt-8">
        <SectionTitle>All feeds</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-4 py-2 font-medium">Property</th>
                <th className="px-4 py-2 font-medium">Platform</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last synced</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {feeds.map((feed) => (
                <tr key={feed.id}>
                  <td className="px-4 py-2">
                    <Link href={`/properties/${feed.property.id}`} className="font-medium text-brand-700 hover:underline">
                      {feed.property.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize text-navy-600">{feed.platform.toLowerCase()}</td>
                  <td className="px-4 py-2">
                    {feed.lastSyncStatus ? <SyncStatusBadge status={feed.lastSyncStatus} /> : <span className="text-xs text-navy-400">Never</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-navy-500">
                    {feed.lastSyncedAt ? `${formatInTz(feed.lastSyncedAt, 'UTC', 'MMM d, h:mm a')} UTC` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={triggerFeedSync.bind(null, feed.id)}>
                      <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-navy-600 hover:bg-navy-50">
                        <RefreshCw className="h-3 w-3" /> Sync
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Recent activity */}
      <section className="mt-8">
        <SectionTitle>Recent sync activity</SectionTitle>
        <Card className="space-y-2">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-navy-500">No sync activity yet.</p>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 border-b border-navy-50 py-1.5 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  <SyncStatusBadge status={log.status} />
                  <span className="text-navy-700">{log.property?.name ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-navy-400">
                  <span>{log.reservationsFound} res · {log.jobsCreated} new jobs</span>
                  <span>{formatInTz(log.startedAt, 'UTC', 'MMM d, h:mm a')} UTC</span>
                </div>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
