import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  LogOut,
  LogIn,
  Timer,
  MapPin,
  Bed,
  Bath,
  Home,
  Clock,
  Users,
  Hash,
  ExternalLink,
  Phone,
} from 'lucide-react';
import { UserRole } from '@prisma/client';
import { requireUser, canAccessJob } from '@/lib/rbac';
import { getJobDetail } from '@/server/queries';
import { PageHeader, Card, SectionTitle } from '@/components/ui';
import { JobStatusBadge, PriorityBadge, SameDayBadge } from '@/components/StatusBadge';
import { JobStatusActions, JobNotes } from '@/components/JobActions';
import { JobPhotos } from '@/components/JobPhotos';
import { JobChecklist } from '@/components/JobChecklist';
import { ProblemReport } from '@/components/ProblemReport';
import { formatInTz } from '@/lib/datetime';
import { formatTurnoverWindow, JOB_STATUS_META } from '@/lib/status';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await canAccessJob(user, id))) redirect('/dashboard');

  const job = await getJobDetail(id);
  if (!job) notFound();

  const tz = job.property.timezone;
  const isOwner = user.role === UserRole.OWNER || user.role === UserRole.ADMIN;
  const isCleaner = user.role === UserRole.CLEANER || user.role === UserRole.ADMIN;
  const backHref = user.role === UserRole.CLEANER ? '/cleaner' : '/jobs';

  const checkedIds = new Set(job.checklistChecks.map((c) => c.itemId));
  const checklistItems = job.property.checklistItems.map((i) => ({
    id: i.id,
    text: i.text,
    checked: checkedIds.has(i.id),
  }));
  const completionPhotos = job.photos.filter((p) => p.kind === 'COMPLETION');
  const problemPhotos = job.photos.filter((p) => p.kind === 'PROBLEM');

  return (
    <div>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <PageHeader
        title={job.property.name}
        subtitle={[job.property.city, job.property.state].filter(Boolean).join(', ') || undefined}
        action={
          <div className="flex items-center gap-2">
            {job.sameDayTurnover && <SameDayBadge />}
            <PriorityBadge priority={job.priority} />
            <JobStatusBadge status={job.status} />
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Turnover window */}
          <Card>
            <SectionTitle>Turnover window</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-50 p-2"><LogOut className="h-5 w-5 text-status-problem" /></div>
                <div>
                  <p className="text-xs text-navy-400">Checkout</p>
                  <p className="font-semibold text-navy-900">{formatInTz(job.checkoutDateTime, tz)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-teal-50 p-2"><LogIn className="h-5 w-5 text-status-available" /></div>
                <div>
                  <p className="text-xs text-navy-400">Next check-in</p>
                  <p className="font-semibold text-navy-900">
                    {job.nextCheckInDateTime ? formatInTz(job.nextCheckInDateTime, tz) : 'No next guest'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-navy-50 p-2"><Timer className="h-5 w-5 text-navy-500" /></div>
                <div>
                  <p className="text-xs text-navy-400">Window</p>
                  <p className="font-semibold text-navy-900">{formatTurnoverWindow(job.turnoverWindowMinutes)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Status actions */}
          <Card>
            <SectionTitle>Update status</SectionTitle>
            <JobStatusActions jobId={job.id} current={job.status} />
          </Card>

          {/* Notes */}
          <Card>
            <SectionTitle>Notes</SectionTitle>
            <JobNotes
              jobId={job.id}
              canEditOwner={isOwner}
              canEditCleaner={isCleaner}
              ownerNotes={job.ownerNotes}
              cleanerNotes={job.cleanerNotes}
            />
          </Card>

          {/* Cleaning checklist */}
          <Card>
            <SectionTitle>Cleaning checklist</SectionTitle>
            <JobChecklist jobId={job.id} items={checklistItems} canCheck={isCleaner} />
          </Card>

          {/* Problem report */}
          <Card>
            <SectionTitle>Report a problem</SectionTitle>
            <ProblemReport
              jobId={job.id}
              canReport={isCleaner}
              problemNote={job.problemNote}
              photos={problemPhotos.map((p) => ({ id: p.id, url: p.url, caption: p.caption }))}
            />
          </Card>

          {/* Photos */}
          <Card>
            <SectionTitle>Completion photos</SectionTitle>
            <JobPhotos
              jobId={job.id}
              canManage={isCleaner}
              photos={completionPhotos.map((p) => ({ id: p.id, url: p.url, caption: p.caption }))}
            />
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <Card>
            <SectionTitle>Property</SectionTitle>
            <Link href={`/properties/${job.propertyId}`} className="flex items-center gap-2 font-medium text-brand-700 hover:underline">
              <Home className="h-4 w-4" /> {job.property.name}
            </Link>
            {(job.property.address || job.property.city) && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-navy-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                {[job.property.address, job.property.city, job.property.state, job.property.zip].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="mt-3 flex gap-4 text-sm text-navy-600">
              <span className="inline-flex items-center gap-1"><Bed className="h-4 w-4 text-navy-400" /> {job.property.bedrooms}</span>
              <span className="inline-flex items-center gap-1"><Bath className="h-4 w-4 text-navy-400" /> {job.property.bathrooms}</span>
            </div>
            {job.property.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-navy-50 p-3 text-sm text-navy-600">{job.property.notes}</p>
            )}
          </Card>

          {/* Booking details — populated by richer providers; iCal fills what it
              can parse. Hidden entirely when nothing is available. */}
          {(job.reservation.guestName ||
            job.reservation.guestCount != null ||
            job.reservation.confirmationCode ||
            job.reservation.guestPhoneLast4 ||
            job.reservation.reservationUrl) && (
            <Card>
              <SectionTitle>Booking details</SectionTitle>
              <dl className="space-y-2 text-sm">
                {job.reservation.guestName && (
                  <div className="flex items-center gap-2 text-navy-700">
                    <Users className="h-4 w-4 text-navy-400" /> {job.reservation.guestName}
                  </div>
                )}
                {job.reservation.guestCount != null && (
                  <div className="flex items-center gap-2 text-navy-700">
                    <Users className="h-4 w-4 text-navy-400" /> {job.reservation.guestCount} guest{job.reservation.guestCount === 1 ? '' : 's'}
                  </div>
                )}
                {job.reservation.confirmationCode && (
                  <div className="flex items-center gap-2 text-navy-700">
                    <Hash className="h-4 w-4 text-navy-400" /> {job.reservation.confirmationCode}
                  </div>
                )}
                {job.reservation.guestPhoneLast4 && (
                  <div className="flex items-center gap-2 text-navy-700">
                    <Phone className="h-4 w-4 text-navy-400" /> ••• {job.reservation.guestPhoneLast4}
                  </div>
                )}
                {job.reservation.reservationUrl && (
                  <a
                    href={job.reservation.reservationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 font-medium text-brand-700 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" /> View on {job.reservation.sourcePlatform.toLowerCase()}
                  </a>
                )}
              </dl>
              {!job.reservation.hasExactTimes && (
                <p className="mt-3 text-xs text-navy-400">
                  Times shown use the property's default check-in/out (this source provides dates only).
                </p>
              )}
            </Card>
          )}

          {/* History */}
          <Card>
            <SectionTitle>History</SectionTitle>
            {job.statusHistory.length === 0 ? (
              <p className="text-sm text-navy-500">No history yet.</p>
            ) : (
              <ol className="space-y-3">
                {job.statusHistory.map((h) => (
                  <li key={h.id} className="flex gap-3 text-sm">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${JOB_STATUS_META[h.toStatus].dot}`} />
                    <div>
                      <p className="font-medium text-navy-800">
                        {h.fromStatus ? `${JOB_STATUS_META[h.fromStatus].label} → ` : ''}
                        {JOB_STATUS_META[h.toStatus].label}
                      </p>
                      {h.note && <p className="text-navy-500">{h.note}</p>}
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-navy-400">
                        <Clock className="h-3 w-3" />
                        {formatInTz(h.createdAt, tz, 'MMM d, h:mm a')}
                        {h.changedByUser?.name ? ` · ${h.changedByUser.name}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
