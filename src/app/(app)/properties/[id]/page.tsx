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
  Pencil,
  DollarSign,
  KeyRound,
  Mail,
} from 'lucide-react';
import { CalendarPlatform, UserRole } from '@prisma/client';
import { requireUser, canAccessProperty } from '@/lib/rbac';
import { getPropertyDetail, listAssignableCleaners } from '@/server/queries';
import { getPropertyFinancials } from '@/server/financials';
import { formatMoney } from '@/lib/money';
import {
  addCalendarFeed,
  assignCleaner,
  removeCalendarFeed,
  triggerPropertySync,
  createInvitation,
  revokeInvitation,
} from '@/server/actions';
import {
  PageHeader,
  Card,
  Field,
  inputClass,
  SectionTitle,
  EmptyState,
  Chip,
} from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { PropertyImageUpload } from '@/components/PropertyImageUpload';
import { ChecklistEditor } from '@/components/ChecklistEditor';
import { InventoryManager } from '@/components/InventoryManager';
import { SubmitButton } from '@/components/SubmitButton';
import { ReservationStatusBadge, SyncStatusBadge } from '@/components/StatusBadge';
import { formatInTz, formatTimeOfDay12 } from '@/lib/datetime';
import { formatTurnoverWindow } from '@/lib/status';

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
  const fin = await getPropertyFinancials(id);
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

  // Operational summary (turnoverJobs are ordered by checkout asc).
  const now = Date.now();
  const nextJob =
    property.turnoverJobs.find(
      (j) => j.status !== 'CANCELED' && j.status !== 'COMPLETED' && j.checkoutDateTime.getTime() >= now,
    ) ?? null;
  const openIssues = property.turnoverJobs.filter((j) => j.status === 'PROBLEM').length;
  const cleanerName =
    property.assignedCleanerUser?.name ||
    property.assignedCleanerUser?.email ||
    property.assignedCleanerOrganization?.name ||
    null;

  return (
    <div>
      <Link href="/properties" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Properties
      </Link>

      <PageHeader
        title={property.name}
        subtitle={
          [
            [property.address, property.unitNumber].filter(Boolean).join(', '),
            property.city,
            property.state,
            property.zip,
          ]
            .filter(Boolean)
            .join(', ') || undefined
        }
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/properties/${property.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-inset ring-navy-200 hover:bg-navy-50"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
            <form action={triggerPropertySync.bind(null, property.id)}>
              <SubmitButton variant="secondary" pendingText="Syncing…">
                <RefreshCw className="h-4 w-4" /> Sync now
              </SubmitButton>
            </form>
          </div>
        }
      />

      {/* Hero image */}
      <div className="mb-6">
        <PropertyImageUpload propertyId={property.id} imageUrl={property.imageUrl} canManage />
      </div>

      {/* Operational summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-navy-400">Next checkout</p>
          <p className="mt-1 text-sm font-semibold text-navy-900">
            {nextJob ? formatInTz(nextJob.checkoutDateTime, tz, 'MMM d, h:mm a') : 'None scheduled'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-navy-400">Turnover window</p>
          <p className={`mt-1 text-sm font-semibold ${nextJob?.sameDayTurnover ? 'text-coral-600' : 'text-navy-900'}`}>
            {nextJob ? formatTurnoverWindow(nextJob.turnoverWindowMinutes) : '—'}
            {nextJob?.sameDayTurnover ? ' · same-day' : ''}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-navy-400">Cleaner</p>
          <p className={`mt-1 text-sm font-semibold ${cleanerName ? 'text-navy-900' : 'text-amber-700'}`}>
            {cleanerName ?? 'Unassigned'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-navy-400">Open issues</p>
          <p className={`mt-1 text-sm font-semibold ${openIssues > 0 ? 'text-coral-600' : 'text-status-completed'}`}>
            {openIssues > 0 ? `${openIssues} open` : 'None'}
          </p>
        </Card>
      </div>

      {/* Attributes */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-navy-600"><Bed className="h-3.5 w-3.5" /> {property.bedrooms} bd</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-navy-600"><Bath className="h-3.5 w-3.5" /> {property.bathrooms} ba</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-navy-600"><LogOut className="h-3.5 w-3.5 text-coral-500" /> out {formatTimeOfDay12(property.defaultCheckOutTime)}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-navy-600"><LogIn className="h-3.5 w-3.5 text-status-available" /> in {formatTimeOfDay12(property.defaultCheckInTime)}</span>
        {property.cleaningPrice != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-navy-600"><DollarSign className="h-3.5 w-3.5 text-status-completed" /> {property.cleaningPrice}/clean</span>
        )}
      </div>

      {/* Financials snapshot */}
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">Financials</h2>
          <Link href="/financials" className="text-xs font-medium text-brand-700 hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Outstanding</p>
            <p className="mt-0.5 text-xl font-extrabold tracking-tight text-amber-700 dark:text-amber-300">{formatMoney(fin.due)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Paid</p>
            <p className="mt-0.5 text-xl font-extrabold tracking-tight text-status-completed dark:text-brand-300">{formatMoney(fin.paid)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Expenses</p>
            <p className="mt-0.5 text-xl font-extrabold tracking-tight text-coral-600 dark:text-coral-300">{formatMoney(fin.expenses)}</p>
          </div>
        </div>
      </Card>

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
              <Card className="overflow-x-auto p-0">
                <table className="w-full min-w-[28rem] text-sm">
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

          {/* Cleaning checklist — hosts and the assigned cleaner can both edit it;
              cleaners tick items off per job. */}
          <section>
            <SectionTitle>Cleaning checklist</SectionTitle>
            <Card>
              <p className="mb-3 text-sm text-navy-500">
                Define exactly how this property should be turned over. The host and the cleaner can
                both add steps; cleaners tick them off on each job.
              </p>
              <ChecklistEditor
                propertyId={property.id}
                items={property.checklistItems.map((i) => ({ id: i.id, text: i.text }))}
              />
            </Card>
          </section>

          {/* Inventory — supplies + linens, editable by host and cleaner */}
          <section>
            <SectionTitle>Inventory</SectionTitle>
            <Card>
              <p className="mb-3 text-sm text-navy-500">
                Track cleaning supplies and linens (by size). The host and cleaner can both add
                items and adjust counts; items at or below their par level are flagged low.
              </p>
              <InventoryManager
                propertyId={property.id}
                items={property.inventoryItems.map((i) => ({
                  id: i.id,
                  category: i.category,
                  name: i.name,
                  size: i.size,
                  unit: i.unit,
                  quantity: i.quantity,
                  parLevel: i.parLevel,
                }))}
              />
            </Card>
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
                <SubmitButton className="w-full" pendingText="Connecting…">
                  <Plus className="h-4 w-4" /> Connect &amp; sync
                </SubmitButton>
              </form>
              <p className="mt-2 text-xs text-navy-400">
                We never ask for your Airbnb/Vrbo password — only the public iCal link. URLs are encrypted at rest.
              </p>
            </Card>
          </section>

          {/* Assign cleaner (owner/admin only) */}
          {user.role !== UserRole.CLEANER && (
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
                <SubmitButton variant="secondary" className="w-full" pendingText="Saving…">
                  Save assignment
                </SubmitButton>
              </form>
            </Card>
          </section>
          )}

          {/* Invitations — host invites a cleaner; cleaner invites the host */}
          <section>
            <SectionTitle>
              {user.role === UserRole.CLEANER ? 'Invite the host' : 'Invite a cleaner'}
            </SectionTitle>
            <Card>
              <p className="mb-3 text-sm text-navy-500">
                {user.role === UserRole.CLEANER
                  ? "Send the host an invite to join Ready2Rent and follow this property's turnovers."
                  : 'Invite a cleaner by email to connect their account to this property.'}
              </p>
              <form action={createInvitation} className="space-y-3">
                <input type="hidden" name="propertyId" value={property.id} />
                <input
                  type="hidden"
                  name="invitedRole"
                  value={user.role === UserRole.CLEANER ? 'OWNER' : 'CLEANER'}
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder={user.role === UserRole.CLEANER ? 'host@example.com' : 'cleaner@example.com'}
                  className={inputClass}
                />
                <SubmitButton variant="secondary" className="w-full" pendingText="Sending…">
                  <Mail className="h-4 w-4" /> Send invite
                </SubmitButton>
              </form>

              {property.invitations.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-navy-100 pt-3">
                  <p className="text-xs font-medium text-navy-400">Pending invites</p>
                  {property.invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-navy-700">
                        {inv.email}
                        <span className="ml-1 text-xs text-navy-400">
                          ({inv.invitedRole === UserRole.CLEANER ? 'cleaner' : 'host'})
                        </span>
                      </span>
                      <form action={revokeInvitation.bind(null, inv.id)}>
                        <button className="text-xs text-navy-400 hover:text-status-problem">Revoke</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          {/* Access — how the cleaner gets in. Visible to the host and the
              assigned cleaner (this page is already access-gated). */}
          {(property.mainDoorAccess || property.ownerClosetAccess) && (
            <section>
              <SectionTitle>Access</SectionTitle>
              <Card className="space-y-2.5 text-sm">
                {property.mainDoorAccess && (
                  <div className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Main door</p>
                      <p className="text-navy-800">{property.mainDoorAccess}</p>
                    </div>
                  </div>
                )}
                {property.ownerClosetAccess && (
                  <div className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Owner&rsquo;s closet</p>
                      <p className="text-navy-800">{property.ownerClosetAccess}</p>
                    </div>
                  </div>
                )}
              </Card>
            </section>
          )}

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
