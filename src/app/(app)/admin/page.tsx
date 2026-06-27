import Link from 'next/link';
import { Activity } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/rbac';
import { getAdminOverview } from '@/server/queries';
import { PageHeader, StatCard, Card, SectionTitle, LinkButton } from '@/components/ui';
import { formatInTz } from '@/lib/datetime';

export default async function AdminOverviewPage() {
  await requireRole(UserRole.ADMIN);
  const o = await getAdminOverview();

  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Platform-wide overview."
        action={<LinkButton href="/admin/sync" variant="secondary"><Activity className="h-4 w-4" /> Sync health</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Users" value={o.users} />
        <StatCard label="Organizations" value={o.orgs} />
        <StatCard label="Properties" value={o.properties} />
        <StatCard label="Reservations" value={o.reservations} />
        <StatCard label="Turnover jobs" value={o.jobs} />
      </div>

      <section className="mt-8">
        <SectionTitle>Recent users</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Organizations</th>
                <th className="px-4 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {o.recentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium text-navy-800">{u.name ?? '—'}</td>
                  <td className="px-4 py-2 text-navy-600">{u.email}</td>
                  <td className="px-4 py-2 capitalize text-navy-600">{u.role.toLowerCase()}</td>
                  <td className="px-4 py-2 text-navy-500">
                    {u.memberships.map((m) => m.organization.name).join(', ') || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-navy-400">
                    {formatInTz(u.createdAt, 'UTC', 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <p className="mt-4 text-sm text-navy-400">
        Need feed diagnostics or to re-run a sync?{' '}
        <Link href="/admin/sync" className="font-medium text-brand-700 hover:underline">
          Open sync health →
        </Link>
      </p>
    </div>
  );
}
