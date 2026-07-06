import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/rbac';
import { createCleanerProperty } from '@/server/actions';
import { PageHeader, Card, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { COMMON_TIMEZONES } from '@/lib/timezones';

export default async function NewCleanerPropertyPage() {
  await requireRole(UserRole.CLEANER, UserRole.ADMIN);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/cleaner/properties" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> My properties
      </Link>
      <PageHeader title="Add a property" subtitle="Paste the host's calendar link — we import the schedule automatically." />

      <Card className="mb-4 flex items-start gap-3 border-brand-200 bg-brand-50/50">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
        <p className="text-sm text-navy-600">
          Ask the host for the property's <strong>Airbnb or Vrbo calendar export (iCal) link</strong>.
          We'll pull reservations and build your turnover schedule. The calendar link only contains
          booking dates — not the property name or address — so add those yourself below.
        </p>
      </Card>

      <Card>
        <form action={createCleanerProperty} className="space-y-5">
          <Field label="Property name" hint="However you want it to appear in your schedule.">
            <input name="name" required placeholder="e.g. Smith Beach House" className={inputClass} />
          </Field>

          <Field label="Calendar (iCal) link" hint="From the host's Airbnb/Vrbo calendar export settings. We auto-detect the platform.">
            <input name="feedUrl" type="url" required placeholder="https://www.airbnb.com/calendar/ical/12345.ics?s=…" className={inputClass} />
          </Field>

          <Field label="Property photo (optional)">
            <input name="image" type="file" accept="image/*" className="block w-full text-sm text-navy-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Default checkout time">
              <input name="defaultCheckOutTime" type="time" defaultValue="10:00" className={inputClass} />
            </Field>
            <Field label="Default check-in time">
              <input name="defaultCheckInTime" type="time" defaultValue="16:00" className={inputClass} />
            </Field>
          </div>

          <Field label="Timezone">
            <select name="timezone" defaultValue="America/New_York" className={inputClass}>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>

          <details className="rounded-xl border border-navy-100 p-4">
            <summary className="cursor-pointer text-sm font-medium text-navy-700">Address &amp; details (optional)</summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field label="Street address"><input name="address" className={inputClass} /></Field>
                </div>
                <Field label="Unit #"><input name="unitNumber" maxLength={40} placeholder="4B" className={inputClass} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="City"><input name="city" className={inputClass} /></Field>
                <Field label="State"><input name="state" className={inputClass} /></Field>
                <Field label="ZIP"><input name="zip" className={inputClass} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bedrooms"><input name="bedrooms" type="number" min={0} defaultValue={0} className={inputClass} /></Field>
                <Field label="Bathrooms"><input name="bathrooms" type="number" min={0} defaultValue={0} className={inputClass} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Main door access" hint="Lockbox/door code, or where the key is.">
                  <input name="mainDoorAccess" maxLength={300} placeholder="Lockbox 4521 on the rail" className={inputClass} />
                </Field>
                <Field label="Owner's closet access" hint="Code, or where that key lives.">
                  <input name="ownerClosetAccess" maxLength={300} placeholder="Code 0210 · hall closet" className={inputClass} />
                </Field>
              </div>
              <Field label="Notes (optional)" hint="Parking, quirks, supply location. Door & lockbox codes go in the access fields above — those are encrypted.">
                <textarea name="notes" rows={2} className={inputClass} placeholder="Parking on the north side, supplies under the sink…" />
              </Field>
            </div>
          </details>

          <div className="rounded-xl border border-navy-100 p-4">
            <p className="text-sm font-semibold text-navy-800">Host notifications</p>
            <p className="mb-3 mt-0.5 text-xs text-navy-500">
              We'll email the host when you start and finish each turnover (with your notes). They don't need an account.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Host name"><input name="ownerName" className={inputClass} /></Field>
                <Field label="Host phone (optional)"><input name="ownerPhone" className={inputClass} /></Field>
              </div>
              <Field label="Host email">
                <input name="ownerEmail" type="email" placeholder="host@example.com" className={inputClass} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-navy-700">
                <input type="checkbox" name="notifyByEmail" defaultChecked className="h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500" />
                Email the host turnover updates
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/cleaner/properties" className="rounded-xl px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50">
              Cancel
            </Link>
            <SubmitButton pendingText="Importing…">Add &amp; import schedule</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
