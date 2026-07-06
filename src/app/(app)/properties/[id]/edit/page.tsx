import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser, canAccessProperty } from '@/lib/rbac';
import { getPropertyDetail } from '@/server/queries';
import { updateProperty } from '@/server/actions';
import { decryptOptional } from '@/lib/crypto';
import { PageHeader, Card, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { COMMON_TIMEZONES } from '@/lib/timezones';
import { ColorPicker } from '@/components/ColorPicker';

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await canAccessProperty(user, id))) redirect('/dashboard');

  const property = await getPropertyDetail(id);
  if (!property) notFound();

  const action = updateProperty.bind(null, property.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/properties/${property.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to property
      </Link>
      <PageHeader title={`Edit ${property.name}`} subtitle="Update details, defaults, color, and pricing." />

      <Card>
        <form action={action} className="space-y-5">
          <Field label="Property name">
            <input name="name" required defaultValue={property.name} className={inputClass} />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="Street address">
                <input name="address" defaultValue={property.address ?? ''} className={inputClass} />
              </Field>
            </div>
            <Field label="Unit #">
              <input name="unitNumber" maxLength={40} defaultValue={property.unitNumber ?? ''} placeholder="Unit 4B" className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="City"><input name="city" defaultValue={property.city ?? ''} className={inputClass} /></Field>
            <Field label="State"><input name="state" defaultValue={property.state ?? ''} className={inputClass} /></Field>
            <Field label="ZIP"><input name="zip" defaultValue={property.zip ?? ''} className={inputClass} /></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Main door access" hint="Lockbox or door code, or where the key is.">
              <input name="mainDoorAccess" maxLength={300} defaultValue={decryptOptional(property.mainDoorAccess) ?? ''} placeholder="Lockbox 4521 on the rail" className={inputClass} />
            </Field>
            <Field label="Owner's closet access" hint="Code, or where that key lives.">
              <input name="ownerClosetAccess" maxLength={300} defaultValue={decryptOptional(property.ownerClosetAccess) ?? ''} placeholder="Code 0210 · hall closet" className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Bedrooms">
              <input name="bedrooms" type="number" min={0} defaultValue={property.bedrooms} className={inputClass} />
            </Field>
            <Field label="Bathrooms">
              <input name="bathrooms" type="number" min={0} defaultValue={property.bathrooms} className={inputClass} />
            </Field>
          </div>

          <Field label="Price per clean (USD)" hint="Shown on the calendar and job cards. Leave blank for none.">
            <div className="flex items-center">
              <span className="rounded-l-xl border border-r-0 border-navy-200 bg-navy-50 px-3 py-2 text-sm text-navy-500">$</span>
              <input
                name="cleaningPrice"
                type="number"
                min={0}
                step={1}
                defaultValue={property.cleaningPrice ?? ''}
                placeholder="120"
                className={`${inputClass} rounded-l-none`}
              />
            </div>
          </Field>

          <Field label="Calendar color" hint="The color of this property's bars on the calendar.">
            <ColorPicker name="calendarColor" propertyId={property.id} defaultValue={property.calendarColor} />
          </Field>

          <Field label="Timezone" hint="Used to resolve checkout/check-in times.">
            <select name="timezone" defaultValue={property.timezone} className={inputClass}>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Default checkout time" hint="When guests leave">
              <input name="defaultCheckOutTime" type="time" defaultValue={property.defaultCheckOutTime} className={inputClass} />
            </Field>
            <Field label="Default check-in time" hint="When new guests arrive">
              <input name="defaultCheckInTime" type="time" defaultValue={property.defaultCheckInTime} className={inputClass} />
            </Field>
          </div>

          <Field label="Notes for cleaners (optional)" hint="Parking, quirks, staging preferences. Put door & lockbox codes in the access fields above — those are encrypted.">
            <textarea name="notes" rows={3} defaultValue={property.notes ?? ''} className={inputClass} />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/properties/${property.id}`}
              className="rounded-xl px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50"
            >
              Cancel
            </Link>
            <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
