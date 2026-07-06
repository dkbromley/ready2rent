import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { updateNotificationPreferences } from '@/server/actions';
import { PageHeader, Card, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

const CATEGORIES: { key: string; label: string; desc: string }[] = [
  { key: 'newJobs', label: 'New turnovers', desc: 'A new reservation created a cleaning job.' },
  { key: 'sameDayTurnover', label: 'Same-day turnovers', desc: 'A guest checks in the same day as checkout — tight window.' },
  { key: 'jobChanges', label: 'Schedule changes', desc: 'Reservation dates changed and a job was updated.' },
  { key: 'jobCompleted', label: 'Completed turnovers', desc: 'A cleaner marked a turnover complete.' },
  { key: 'jobCanceled', label: 'Canceled turnovers', desc: 'A reservation was removed or a job was canceled.' },
  { key: 'problems', label: 'Problems flagged', desc: 'A cleaner reported an issue that may need attention.' },
];

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const [prefs, me] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } }),
  ]);
  // No row yet = everything on (opt-out model).
  const value = (key: string): boolean =>
    prefs ? (prefs as unknown as Record<string, boolean>)[key] ?? true : true;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/notifications" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Notifications
      </Link>
      <PageHeader
        title="Notification preferences"
        subtitle="Choose which alerts you receive. Turn off the noise, keep what matters."
      />

      <Card>
        <form action={updateNotificationPreferences} className="space-y-1">
          <div className="mb-4 border-b border-sand-100 p-3 pb-5">
            <Field
              label="Mobile number (optional)"
              hint="Where schedule texts will go — same-day turnovers, changes, problems. Text alerts aren't live yet; adding your number now means they reach you the moment they launch."
            >
              <input
                name="phone"
                type="tel"
                maxLength={40}
                defaultValue={me?.phone ?? ''}
                placeholder="(910) 555-0134"
                className={inputClass}
              />
            </Field>
          </div>
          {CATEGORIES.map((c) => (
            <label
              key={c.key}
              className="flex cursor-pointer items-start justify-between gap-4 rounded-xl p-3 transition hover:bg-navy-50"
            >
              <span>
                <span className="block text-sm font-medium text-navy-900">{c.label}</span>
                <span className="block text-xs text-navy-500">{c.desc}</span>
              </span>
              <input
                type="checkbox"
                name={c.key}
                defaultChecked={value(c.key)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
              />
            </label>
          ))}
          <div className="flex justify-end pt-3">
            <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
