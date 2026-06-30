import Link from 'next/link';
import Image from 'next/image';
import { Waves, Home, MapPin, CheckCircle2, Sparkles } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/rbac';
import { Card, Button } from '@/components/ui';
import { ClaimForm } from './ClaimForm';
import { claimAsCurrentUser } from '../actions';

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="coastal-gradient flex min-h-screen flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-navy-900">
          <Waves className="h-6 w-6 text-brand-600" /> Ready2Rent
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contact = await prisma.propertyOwnerContact.findUnique({
    where: { claimToken: token },
    include: { property: { select: { name: true, address: true, city: true, state: true, imageUrl: true } } },
  });

  if (!contact) {
    return (
      <Shell>
        <Card className="text-center">
          <p className="text-base font-semibold text-navy-800">This claim link isn&apos;t valid</p>
          <p className="mt-1 text-sm text-navy-500">It may have expired or already been used.</p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">Go to sign in</Link>
        </Card>
      </Shell>
    );
  }

  if (contact.claimedByUserId) {
    return (
      <Shell>
        <Card className="text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-status-completed" />
          <p className="mt-2 text-base font-semibold text-navy-800">{contact.property.name} is already claimed</p>
          <p className="mt-1 text-sm text-navy-500">Sign in to manage it.</p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">Sign in</Link>
        </Card>
      </Shell>
    );
  }

  const user = await getCurrentUser();
  const p = contact.property;

  return (
    <Shell>
      <Card className="p-0">
        {p.imageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-navy-100">
            <Image src={p.imageUrl} alt={p.name} fill sizes="448px" className="object-cover" />
          </div>
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center rounded-t-2xl bg-brand-50">
            <Home className="h-10 w-10 text-brand-600" />
          </div>
        )}
        <div className="p-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            <Sparkles className="h-3.5 w-3.5" /> Claim your property
          </span>
          <h1 className="mt-3 text-xl font-bold text-navy-900">{p.name}</h1>
          {(p.address || p.city) && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-navy-500">
              <MapPin className="h-4 w-4" /> {[p.address, p.city, p.state].filter(Boolean).join(', ')}
            </p>
          )}
          <p className="mt-4 text-sm text-navy-600">
            Claim this property to track every turnover yourself, see live cleaning status and photos, and manage your
            cleaner — all in one place. Your cleaner stays connected; nothing on their end changes.
          </p>

          <div className="mt-6">
            {user && (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) ? (
              <form action={claimAsCurrentUser.bind(null, token)}>
                <Button type="submit" className="w-full">Claim as {user.name ?? user.email}</Button>
              </form>
            ) : user ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                You&apos;re signed in as a cleaner. <Link href="/api/auth/signout" className="font-medium underline">Sign out</Link> to claim this property as the host.
              </p>
            ) : (
              <ClaimForm token={token} defaultEmail={contact.email ?? ''} />
            )}
          </div>

          {!user && (
            <p className="mt-4 text-center text-sm text-navy-500">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
            </p>
          )}
        </div>
      </Card>
    </Shell>
  );
}
