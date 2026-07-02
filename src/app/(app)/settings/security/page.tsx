import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/rbac';
import { PageHeader, Card } from '@/components/ui';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

export const metadata = { title: 'Account & security' };

export default async function SecuritySettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <PageHeader
        eyebrow="Account & security"
        title="Change password"
        subtitle={user.email ?? undefined}
      />
      <Card>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
