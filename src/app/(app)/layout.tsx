import { requireUser } from '@/lib/rbac';
import { getUnreadNotificationCount } from '@/server/queries';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/AppShell';
import { TimezoneSync } from '@/components/TimezoneSync';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, dbUser] = await Promise.all([
    getUnreadNotificationCount(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { timezone: true } }),
  ]);

  return (
    <AppShell role={user.role} name={user.name} email={user.email} unread={unread}>
      <TimezoneSync current={dbUser?.timezone} />
      {children}
    </AppShell>
  );
}
