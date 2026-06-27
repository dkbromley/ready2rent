import { requireUser } from '@/lib/rbac';
import { getUnreadNotificationCount } from '@/server/queries';
import { AppShell } from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await getUnreadNotificationCount(user.id);

  return (
    <AppShell role={user.role} name={user.name} email={user.email} unread={unread}>
      {children}
    </AppShell>
  );
}
