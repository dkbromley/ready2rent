import Link from 'next/link';
import { ArrowLeft, HandCoins } from 'lucide-react';
import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { updatePayoutProfile } from '@/server/actions';
import { PageHeader, Card, inputClass, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '@/lib/money';

const HANDLE_HINT: Record<string, string> = {
  VENMO: 'Your Venmo username, e.g. @maria-cleans',
  CASH_APP: 'Your $cashtag, e.g. $MariaCleans',
  ZELLE: 'The email or phone number your Zelle uses',
  APPLE_PAY: 'The phone number or email tied to Apple Cash',
  CASH: 'Anything hosts should know, e.g. "envelope on the counter"',
  OTHER: 'How hosts should pay you',
};

export default async function PayoutSettingsPage() {
  const user = await requireUser();
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { payoutMethod: true, payoutHandle: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/financials" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Financials
      </Link>
      <PageHeader
        title="How you get paid"
        subtitle="Ready2Rent never touches your money and never takes a cut. Tell hosts how you like to be paid, and every payment they owe you shows your handle — with a one-tap pay link where the app supports it."
      />

      <Card>
        <form action={updatePayoutProfile} className="space-y-4">
          <Field label="Preferred method">
            <select name="payoutMethod" className={inputClass} defaultValue={me?.payoutMethod ?? ''}>
              <option value="">Not set</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Handle" hint="Shown to hosts who owe you a payment.">
            <input
              name="payoutHandle"
              defaultValue={me?.payoutHandle ?? ''}
              maxLength={120}
              placeholder="@your-handle"
              className={inputClass}
            />
          </Field>
          <div className="rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-800 ring-1 ring-inset ring-brand-600/10">
            <p className="flex items-start gap-2">
              <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                {(me?.payoutMethod && HANDLE_HINT[me.payoutMethod]) ||
                  'Venmo and Cash App handles become one-tap "Pay" buttons for your hosts. Zelle, Apple Pay, and cash show your handle as text.'}
              </span>
            </p>
          </div>
          <SubmitButton pendingText="Saving…">Save payout profile</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
