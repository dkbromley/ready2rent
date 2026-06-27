import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash2,
  LogOut,
  LogIn,
  Bed,
  Bath,
  CalendarClock,
} from 'lucide-react';
import { CalendarPlatform } from '@prisma/client';
import { requireUser, canAccessProperty } from '@/lib/rbac';
import { getPropertyDetail, listAssignableCleaners } from '@/server/queries';
import {
  addCalendarFeed,
  assignCleaner,
  removeCalendarFeed,
  triggerPropertySync,
} from '@/server/actions';
import {
  PageHeader,
  Card,
  Button,
  Field,
  inputClass,
  SectionTitle,
  EmptyState,
  Chip,
} from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { ReservationStatusBadge, SyncStatusBadge } from '@/components/StatusBadge';
import { formatInTz } from '@/lib/datetime';

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await canAccessProperty(user, id))) redirect('/dashboard');

  const property = await getPropertyDetail(id);
  if (!property) notFound();

  const { orgs, users } = await listAssignableCleaners();
  const tz = property.timezone;
  const activeFeeds = property.calendarFeeds.filter((f) => f.active);
  const currentAssignee = property.assignedCleanerUserId
    ? `user:${property.assignedCleanerUserId}`
    : property.assignedCleanerOrganizationId
      ? `org:${property.assignedCleanerOrganizationId}`
      : '';

  const liveReservations = property.reservations.filter(
    (r) => r.status === 'ACTIVE' || r.status === 'CHANGED',
  );

  return (
    <div>
      <Link href="/properties" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Properties
      </Link>

      <PageHeader
        title={property.name}
        subtitle={[property.address, property.city, property.state, property.zip].filter(Boolean).join(', ') || undefined}
        action={
          <form action={triggerPropertySync.bind(null, property.id)}>
            <Button variant="secondary" type="submit">
              <RefreshCw className="h-4 w-4" /> Sync now
            </Button>
          </form>
        }
      />

      {/* Quick facts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <Bed className="h-5 w-5 text-navy-400" />
          <div>
            <p className="text-xs text-navy-400">Bedrooms</p>
            <p className="font-semibold text-navy-900">{property.bedrooms}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Bath className="h-5 w-5 text-navy-400" />
          <div>
            <p className="text-xs text-navy-400">Bathrooms</p>
            <p className="font-semibold text-navy-900">{property.bathrooms}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <LogOut className="h-5 w-5 text-status-problem" />
          <div>
            <p className="text-xs text-navy-400">Checkout</p>
            <p className="font-semibold text-navy-900">{property.defaultCheckOutTime}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <LogIn className="h-5 w-5 text-status-available" />
          <div>
            <p className="text-xs text-navy-400">Check-in</p>
            <p className="font-semibold text-navy-900">{property.defaultCheckInTime}</p>
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Turnover jobs */}
          <section>
            <SectionTitle>Turnover jobs</SectionTitle>
            {property.turnoverJobs.length === 0 ? (
              <EmptyState
                title="No turnover jobs yet"
                description="Connect a calendar feed and reservations will become jobs automatically."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {property.turnoverJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={{ ...job, property: { name: property.name, city: property.city, state: property.state, timezone: tz } }}
                    compact
                  />
                ))}
              </div>
            )}
          </section>

          {/* Reservations */}
          <section>
            <SectionTitle>Imported reservations ({liveReservations.length} active)</SectionTitle>
            {property.reservations.length === 0 ? (
              <Card className="text-sm text-navy-500">No reservations imported yet.</Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Check-in</th>
                      <th className="px-4 py-2 font-medium">Checkout</th>
                      <th className="px-4 py-2 font-medium">Source</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {property.reservations.slice(0, 30).map((r) => (
                      <tr key={r.id} className={r.duplicateOfId ? 'opacity-60' : ''}>
                        <td className="whitespace-nowrap px-4 py-2 text-navy-700">{formatInTz(r.checkInDate, tz, 'MMM d, yyyy')}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-navy-700">{formatInTz(r.checkOutDate, tz, 'MMM d, yyyy')}</td>
                        <td className="px-4 py-2">
                          <span className="text-xs font-medium capitalize text-navy-500">{r.sourcePlatform.toLowerCase()}</span>
                          {r.duplicateOfId && <span className="ml-1 text-xs text-navy-400">(dupe)</span>}
                        </td>
                        <td className="px-4 py-2"><ReservationStatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </div>

        {/* Sidebar: feeds + assignment + notes */}
        <div className="space-y-8">
          {/* Calendar feeds */}
          <section>
            <SectionTitle>Calendar feeds</SectionTitle>
            <div className="space-y-2">
              {activeFeeds.map((feed) => (
                <Card key={feed.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize text-navy-900">{feed.platform.toLowerCase()}</span>
                    {feed.lastSyncStatus ? <SyncStatusBadge status={feed.lastSyncStatus} /> : <Chip className="bg-navy-100 text-navy-600 ring-navy-600/20">Not synced</Chip>}
                  </div>
                  <p className="mt-1 text-xs text-navy-400">
                    {feed.lastSyncedAt ? `Last synced ${formatInTz(feed.lastSyncedAt, tz, 'MMM d, h:mm a')}` : 'Awaiting first sync'}
                  </p>
                  {feed.lastSyncError && (
                    <p className="mt-1 text-xs text-status-problem">{feed.lastSyncError}</p>
                  )}
                  <form action={removeCalendarFeed.bind(null, feed.id, property.id)} className="mt-2">
                    <button className="inline-flex items-center gap-1 text-xs text-navy-400 hover:text-status-problem">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </form>
                </Card>
              ))}
            </div>

            {/* Connect calendar form */}
            <Card className="mt-3">
              <p className="mb-3 text-sm font-semibold text-navy-800">Connect a calendar</p>
              <form action={addCalendarFeed} className="space-y-3">
                <input type="hidden" name="propertyId" value={property.id} />
                <Field label="Platform">
                  <select name="platform" defaultValue={CalendarPlatform.AIRBNB} className={inputClass}>
                    <option value={CalendarPlatform.AIRBNB}>Airbnb</option>
                    <option value={CalendarPlatform.VRBO}>Vrbo</option>
                    <option value={CalendarPlatform.MANUAL}>Manual / Other</option>
                  </select>
                </Field>
                <Field label="iCal export URL" hint="Find this in your listing's calendar export settings.">
                  <input name="feedUrl" type="url" required placeholder="https://www.airbnb.com/calendar/ical/…" className={inputClass} />
                </Field>
                <Button type="submit" className="w-full">
                  <Plus className="h-4 w-4" /> Connect &amp; sync
                </Button>
              </form>
              <p className="mt-2 text-xs text-navy-400">
                We never ask for your Airbnb/Vrbo password — only the public iCal link. URLs are encrypted at rest.
              </p>
            </Card>
          </section>

          {/* Assign cleaner */}
          <section>
            <SectionTitle>Assigned cleaner</SectionTitle>
            <Card>
              <form action={assignCleaner} className="space-y-3">
                <input type="hidden" name="propertyId" value={property.id} />
                <select name="assignee" defaultValue={currentAssignee} className={inputClass}>
                  <option value="">— Unassigned —</option>
                  {users.length > 0 && (
                    <optgroup label="Cleaners">
                      {users.map((u) => (
                        <option key={u.id} value={`user:${u.id}`}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {orgs.length > 0 && (
                    <optgroup label="Cleaning companies">
                      {orgs.map((o) => (
                        <option key={o.id} value={`org:${o.id}`}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <Button type="submit" variant="secondary" className="w-full">
                  Save assignment
                </Button>
              </form>
            </Card>
          </section>

          {/* Notes */}
          {property.notes && (
            <section>
              <SectionTitle>Notes</SectionTitle>
              <Card className="text-sm text-navy-600">
                <CalendarClock className="mb-2 h-4 w-4 text-navy-400" />
                {property.notes}
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
