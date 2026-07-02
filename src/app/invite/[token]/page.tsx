import Link from 'next/link';
import { Sparkles, Home, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { InviteStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/rbac';
import { acceptInvitation } from '@/server/actions';
import { Card, Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="coastal-gradient flex min-h-screen flex-col">
      <header className="px-6 py-5">
        <Link href="/" aria-label="Ready2Rent home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function Invalid({ message }: { message: string }) {
  return (
    <Shell>
      <Card className="text-center">
        <p className="text-base font-semibold text-navy-800">This invitation isn&apos;t valid</p>
        <p className="mt-1 text-sm text-navy-500">{message}</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
          Go to sign in
        </Link>
      </Card>
    </Shell>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invitation.findUnique({
    where: { token },
    include: {
      invitedBy: { select: { name: true, email: true } },
      property: { select: { name: true, city: true, state: true } },
    },
  });

  if (!inv) return <Invalid message="It may have been revoked or never existed." />;
  if (inv.status === InviteStatus.ACCEPTED) return <Invalid message="This invitation was already accepted." />;
  if (inv.status === InviteStatus.REVOKED) return <Invalid message="This invitation was revoked." />;
  if (inv.expiresAt && inv.expiresAt < new Date()) return <Invalid message="This invitation has expired." />;

  const inviter = inv.invitedBy.name || inv.invitedBy.email;
  const roleWord = inv.invitedRole === UserRole.CLEANER ? 'cleaner' : 'host';
  const user = await getCurrentUser();

  return (
    <Shell>
      <Card className="p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
          <Sparkles className="h-3.5 w-3.5" /> You&apos;re invited
        </span>
        <h1 className="mt-3 text-xl font-bold text-navy-900">
          {inviter} invited you to Ready2Rent
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Join as the <strong>{roleWord}</strong>
          {inv.property ? (
            <>
              {' '}for{' '}
              <span className="inline-flex items-center gap-1 font-medium text-navy-800">
                <Home className="h-4 w-4 text-navy-400" /> {inv.property.name}
              </span>
            </>
          ) : null}
          .
        </p>

        <div className="mt-6">
          {user ? (
            <form action={acceptInvitation.bind(null, token)}>
              <Button type="submit" className="w-full">
                <CheckCircle2 className="h-4 w-4" /> Accept as {user.name ?? user.email}
              </Button>
              <p className="mt-2 text-center text-xs text-navy-400">
                Signed in as {user.email}. Wrong account?{' '}
                <Link href="/api/auth/signout" className="underline">Sign out</Link>.
              </p>
            </form>
          ) : (
            <div className="space-y-3">
              <Link
                href={`/signup?invite=${inv.token}&email=${encodeURIComponent(inv.email)}&role=${inv.invitedRole}`}
                className="block"
              >
                <Button className="w-full">Create account &amp; accept</Button>
              </Link>
              <p className="text-center text-sm text-navy-500">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-brand-700 hover:underline">
                  Sign in
                </Link>{' '}
                then reopen this invite link.
              </p>
            </div>
          )}
        </div>
      </Card>
    </Shell>
  );
}
