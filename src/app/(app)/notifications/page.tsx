import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { markAllNotificationsRead } from '@/server/actions';
import { PageHeader, Card, Button, EmptyState } from '@/components/ui';
import { formatInTz } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle="Job and reservation updates across your properties."
        action={
          hasUnread ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="secondary"><CheckCheck className="h-4 w-4" /> Mark all read</Button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet" description="You'll be notified when turnover jobs are created, changed, completed, or canceled." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const inner = (
              <Card className={cn('flex items-start gap-3', !n.read && 'border-brand-200 bg-brand-50/40')}>
                <div className={cn('mt-0.5 rounded-lg p-2', n.read ? 'bg-navy-100 text-navy-500' : 'bg-brand-100 text-brand-700')}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy-900">{n.title}</p>
                  {n.body && <p className="text-sm text-navy-500">{n.body}</p>}
                  <p className="mt-1 text-xs text-navy-400">{formatInTz(n.createdAt, 'UTC', 'MMM d, h:mm a')} UTC</p>
                </div>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              </Card>
            );
            return n.jobId ? (
              <Link key={n.id} href={`/jobs/${n.jobId}`} className="block">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
