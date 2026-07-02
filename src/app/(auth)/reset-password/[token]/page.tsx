import { Card } from '@/components/ui';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

export const metadata = { title: 'Reset password' };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <Card className="p-7">
      <h1 className="text-xl font-bold text-navy-900">Choose a new password</h1>
      <p className="mt-1 text-sm text-navy-500">Enter a new password for your account.</p>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </Card>
  );
}
