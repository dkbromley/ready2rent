import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { UserRole } from '@prisma/client';
import { createProperty } from '@/server/actions';
import { PageHeader, Card, Button, Field, inputClass } from '@/components/ui';
import { COMMON_TIMEZONES } from '@/lib/timezones';

export default async function NewPropertyPage() {
  await requireRole(UserRole.OWNER, UserRole.ADMIN);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/properties" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Back to properties
      </Link>
      <PageHeader title="Add property" subtitle="You can connect calendars in the next step." />

      <Card>
        <form action={createProperty} className="space-y-5">
          <Field label="Property name">
            <input name="name" required placeholder="e.g. Sandpiper Cottage" className={inputClass} />
          </Field>

          <Field label="Street address">
            <input name="address" placeholder="123 Ocean Blvd" className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="City"><input name="city" className={inputClass} /></Field>
            <Field label="State"><input name="state" className={inputClass} /></Field>
            <Field label="ZIP"><input name="zip" className={inputClass} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Bedrooms">
              <input name="bedrooms" type="number" min={0} defaultValue={1} className={inputClass} />
            </Field>
            <Field label="Bathrooms">
              <input name="bathrooms" type="number" min={0} defaultValue={1} className={inputClass} />
            </Field>
          </div>

          <Field label="Timezone" hint="Used to resolve checkout/check-in times.">
            <select name="timezone" defaultValue="America/New_York" className={inputClass}>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Default checkout time" hint="When guests leave">
              <input name="defaultCheckOutTime" type="time" defaultValue="10:00" className={inputClass} />
            </Field>
            <Field label="Default check-in time" hint="When new guests arrive">
              <input name="defaultCheckInTime" type="time" defaultValue="16:00" className={inputClass} />
            </Field>
          </div>

          <Field label="Notes for cleaners (optional)">
            <textarea name="notes" rows={3} placeholder="Gate code, supply closet location, parking…" className={inputClass} />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/properties" className="rounded-xl px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50">
              Cancel
            </Link>
            <Button type="submit">Create property</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
