import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/rbac';
import { PageHeader, Card } from '@/components/ui';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { DeleteAccountForm } from '@/components/DeleteAccountForm';

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
        <h2 className="mb-3 text-sm font-semibold text-navy-800">Change password</h2>
        <ChangePasswordForm />
      </Card>

      <div className="mt-8 rounded-2xl border border-coral-300/60 bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold text-coral-600 dark:text-coral-300">Danger zone</h2>
        <div className="mt-3">
          <DeleteAccountForm email={user.email ?? ''} />
        </div>
      </div>
    </div>
  );
}
