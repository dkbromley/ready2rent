import { requireUser } from '@/lib/rbac';
import { getFinancials } from '@/server/financials';
import { receiptViewUrl } from '@/lib/storage';
import { PageHeader } from '@/components/ui';
import { FinancialsManager } from '@/components/FinancialsManager';

export default async function FinancialsPage() {
  const user = await requireUser();
  const data = await getFinancials(user);

  const payments = data.payments.map((p) => {
    // Payee = the job's specific assignee, else the property's standing cleaner.
    const payee = p.job?.assignedUser ?? p.property.assignedCleanerUser;
    return {
      id: p.id,
      propertyId: p.propertyId,
      propertyName: p.property.name,
      amount: p.amount,
      method: p.method,
      status: p.status,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      confirmedAt: p.confirmedAt,
      reference: p.reference,
      note: p.note,
      fromJob: p.jobId != null,
      payeeName: payee?.name ?? null,
      payeeMethod: payee?.payoutMethod ?? null,
      payeeHandle: payee?.payoutHandle ?? null,
    };
  });

  // Receipts live in a private bucket; mint short-lived signed URLs here, after
  // getFinancials has already scoped expenses to the viewer's properties.
  const expenses = await Promise.all(
    data.expenses.map(async (e) => ({
      id: e.id,
      propertyId: e.propertyId,
      propertyName: e.property.name,
      amount: e.amount,
      category: e.category,
      description: e.description,
      vendor: e.vendor,
      incurredAt: e.incurredAt,
      receiptUrl: await receiptViewUrl(e.receiptUrl),
    })),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Financials"
        title="Payments & expenses"
        subtitle="Track what's owed, what's been paid, and per-property costs. Stripe automation is coming; for now record Apple Pay, Venmo, Cash App, and Zelle here."
      />
      <FinancialsManager
        role={data.role}
        properties={data.properties.map((p) => ({ id: p.id, name: p.name }))}
        payments={payments}
        expenses={expenses}
        summary={data.summary}
        perProperty={data.perProperty}
      />
    </div>
  );
}
