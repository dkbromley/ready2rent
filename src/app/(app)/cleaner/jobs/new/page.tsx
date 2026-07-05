import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/rbac';
import { listCleanerProperties } from '@/server/queries';
import { PageHeader } from '@/components/ui';
import { ManualJobForm } from './ManualJobForm';

export const metadata = { title: 'New job' };

export default async function NewManualJobPage() {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const properties = await listCleanerProperties(user);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Beyond turnovers"
        title="Schedule a job"
        subtitle="One-off cleans, move-outs, and deep cleans — same checklists, photo proof, and payment tracking as your turnovers."
      />
      <ManualJobForm properties={properties.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}
