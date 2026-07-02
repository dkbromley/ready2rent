import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Waves, LogOut, LogIn, CheckCircle2 } from 'lucide-react';
import { JobStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatInTz } from '@/lib/datetime';
import { JOB_STATUS_META } from '@/lib/status';

export const dynamic = 'force-dynamic';

/**
 * Public, no-login property status page. The owner-notification emails link here.
 * Shows live turnover status + recent completed turnovers with photos, and a
 * "join free" CTA — the conversion surface for off-platform owners.
 */
export default async function PublicStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const property = await prisma.property.findUnique({
    where: { publicToken: token },
    include: {
      ownerContact: { select: { claimToken: true, claimedByUserId: true } },
      turnoverJobs: {
        where: { status: { not: JobStatus.CANCELED } },
        orderBy: { checkoutDateTime: 'asc' },
        include: { photos: { orderBy: { createdAt: 'desc' }, take: 4 } },
      },
    },
  });
  if (!property) notFound();

  const unclaimed = property.ownerContact && !property.ownerContact.claimedByUserId;
  const ctaHref = unclaimed ? `/claim/${property.ownerContact!.claimToken}` : '/signup';

  const tz = property.timezone;
  const now = Date.now();
  const current =
    property.turnoverJobs.find((j) => j.status === JobStatus.IN_PROGRESS) ??
    property.turnoverJobs.find(
      (j) => j.checkoutDateTime.getTime() >= now && j.status !== JobStatus.COMPLETED,
    );
  const completed = property.turnoverJobs
    .filter((j) => j.status === JobStatus.COMPLETED)
    .slice(-3)
    .reverse();

  return (
    <div className="coastal-gradient min-h-screen">
      <header className="mx-auto flex max-w-2xl items-center gap-2 px-6 py-5">
        <Waves className="h-6 w-6 text-brand-600" />
        <span className="font-bold text-navy-900">Ready2Rent</span>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-16">
        {property.imageUrl && (
          <div className="relative mb-5 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-navy-100 sm:aspect-[21/9]">
            <Image src={property.imageUrl} alt={property.name} fill sizes="(max-width:768px) 100vw, 640px" className="object-cover" priority />
          </div>
        )}
        <p className="text-sm font-medium text-brand-700">Turnover status</p>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">{property.name}</h1>
        {(property.city || property.state) && (
          <p className="text-sm text-navy-500">{[property.city, property.state].filter(Boolean).join(', ')}</p>
        )}

        {/* Current / next */}
        <div className="card mt-6 p-5">
          {current ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-navy-500">
                  {current.status === JobStatus.IN_PROGRESS ? 'Cleaning in progress' : 'Next turnover'}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${JOB_STATUS_META[current.status].chip}`}>
                  {JOB_STATUS_META[current.status].label}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 text-sm">
                  <LogOut className="h-4 w-4 text-status-problem" />
                  <span className="font-medium text-navy-700">Checkout</span>
                  <span className="text-navy-500">{formatInTz(current.checkoutDateTime, tz)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <LogIn className="h-4 w-4 text-status-available" />
                  <span className="font-medium text-navy-700">Next check-in</span>
                  <span className="text-navy-500">{current.nextCheckInDateTime ? formatInTz(current.nextCheckInDateTime, tz) : '—'}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-navy-500">No upcoming turnovers scheduled right now.</p>
          )}
        </div>

        {/* Recent completed */}
        {completed.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">Recent turnovers</h2>
            <div className="space-y-3">
              {completed.map((job) => (
                <div key={job.id} className="card p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-status-completed" />
                    <span className="font-medium text-navy-800">Completed</span>
                    <span className="text-navy-400">
                      {job.completedAt ? formatInTz(job.completedAt, tz, 'MMM d, h:mm a') : formatInTz(job.checkoutDateTime, tz, 'MMM d')}
                    </span>
                  </div>
                  {job.cleanerNotes && <p className="mt-2 text-sm text-navy-600">{job.cleanerNotes}</p>}
                  {job.photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {job.photos.map((ph) => (
                        <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-lg bg-navy-100">
                          <Image src={ph.url} alt="Turnover photo" fill sizes="120px" className="object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="ocean-hero mt-8 rounded-2xl p-6 text-center text-white shadow-card">
          <p className="text-lg font-semibold">Want to manage turnovers yourself?</p>
          <p className="mt-1 text-sm text-white/70">Track every checkout, assign cleaners, and connect all your listings in one place.</p>
          <Link href={ctaHref} className="mt-4 inline-flex rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-400">
            {unclaimed ? 'Claim this property free' : 'Join Ready2Rent free'}
          </Link>
        </div>
      </main>
    </div>
  );
}
