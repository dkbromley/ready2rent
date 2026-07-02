'use client';

import { useState } from 'react';
import { PaymentMethod, PaymentStatus, ExpenseCategory, UserRole } from '@prisma/client';
import { format } from 'date-fns';
import {
  Plus,
  Trash2,
  Check,
  Undo2,
  Receipt,
  Wallet,
  Banknote,
  CalendarClock,
  ExternalLink,
} from 'lucide-react';
import { Card, StatTile, EmptyState, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { cn } from '@/lib/utils';
import {
  formatMoney,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_META,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
} from '@/lib/money';
import {
  recordPayment,
  markPaymentPaid,
  markPaymentDue,
  deletePayment,
  addExpense,
  deleteExpense,
} from '@/server/actions';

export interface PaymentRow {
  id: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  method: PaymentMethod | null;
  status: PaymentStatus;
  dueDate: Date | null;
  paidAt: Date | null;
  reference: string | null;
  note: string | null;
  fromJob: boolean;
}

export interface ExpenseRow {
  id: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  vendor: string | null;
  incurredAt: Date;
  receiptUrl: string | null;
}

export interface PerPropertyRow {
  propertyId: string;
  name: string;
  due: number;
  paid: number;
  expenses: number;
}

interface Props {
  role: UserRole;
  properties: { id: string; name: string }[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  summary: { outstanding: number; paidThisMonth: number; expensesThisMonth: number };
  perProperty: PerPropertyRow[];
}

const fmtDate = (d: Date | null | undefined) => (d ? format(new Date(d), 'MMM d, yyyy') : '—');

function confirmSubmit(message: string) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm(message)) e.preventDefault();
  };
}

export function FinancialsManager({ role, properties, payments, expenses, summary, perProperty }: Props) {
  const isCleaner = role === UserRole.CLEANER;
  const [openForm, setOpenForm] = useState<'payment' | 'expense' | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const due = payments.filter((p) => p.status === PaymentStatus.DUE);
  const settled = payments.filter((p) => p.status !== PaymentStatus.DUE);
  const canAdd = properties.length > 0;

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile
          icon={<CalendarClock className="h-5 w-5" />}
          tone="amber"
          label={isCleaner ? 'Owed to you' : 'Outstanding'}
          value={formatMoney(summary.outstanding)}
        />
        <StatTile
          icon={<Wallet className="h-5 w-5" />}
          tone="green"
          label={isCleaner ? 'Received this month' : 'Paid this month'}
          value={formatMoney(summary.paidThisMonth)}
        />
        <StatTile
          icon={<Banknote className="h-5 w-5" />}
          tone="coral"
          label="Expenses this month"
          value={formatMoney(summary.expensesThisMonth)}
        />
      </div>

      {/* Add actions */}
      {canAdd ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setOpenForm(openForm === 'payment' ? null : 'payment')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
              openForm === 'payment'
                ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20'
                : 'bg-surface text-navy-800 ring-1 ring-inset ring-navy-200 hover:bg-navy-50',
            )}
          >
            <Plus className="h-4 w-4" /> Record payment
          </button>
          <button
            onClick={() => setOpenForm(openForm === 'expense' ? null : 'expense')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
              openForm === 'expense'
                ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20'
                : 'bg-surface text-navy-800 ring-1 ring-inset ring-navy-200 hover:bg-navy-50',
            )}
          >
            <Receipt className="h-4 w-4" /> Add expense
          </button>
        </div>
      ) : (
        <p className="text-sm text-navy-500">Add a property first to track its payments and expenses.</p>
      )}

      {openForm === 'payment' && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-navy-800">Record a payment</h3>
          <form action={recordPayment} className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-navy-600">Property</span>
              <select name="propertyId" required className={inputClass}>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-600">Amount ($)</span>
              <input name="amount" type="number" min={0} required placeholder="120" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-600">Status</span>
              <select name="status" className={inputClass} defaultValue={PaymentStatus.DUE}>
                <option value={PaymentStatus.DUE}>Due</option>
                <option value={PaymentStatus.PAID}>Paid</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-600">Due date</span>
              <input name="dueDate" type="date" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-600">Method</span>
              <select name="method" className={inputClass} defaultValue="">
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-navy-600">Reference / note (e.g. Venmo handle)</span>
              <input name="reference" className={inputClass} placeholder="@handle · confirmation #" />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Saving…">Save payment</SubmitButton>
            </div>
          </form>
        </Card>
      )}

      {openForm === 'expense' && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-navy-800">Add an expense</h3>
          <form
            action={addExpense}
            encType="multipart/form-data"
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-navy-600">Property</span>
              <select name="propertyId" required className={inputClass}>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-600">Amount ($)</span>
              <input name="amount" type="number" min={0} required placeholder="45" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-600">Category</span>
              <select name="category" className={inputClass} defaultValue={ExpenseCategory.SUPPLIES}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-navy-600">Description</span>
              <input name="description" required maxLength={200} placeholder="Paper towels, cleaning supplies" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-600">Vendor (optional)</span>
              <input name="vendor" className={inputClass} placeholder="Costco" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-600">Date</span>
              <input name="incurredAt" type="date" className={inputClass} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-navy-600">Receipt (image or PDF, optional)</span>
              <input name="receipt" type="file" accept="image/*,application/pdf" className="block w-full text-sm text-navy-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700" />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Saving…">Save expense</SubmitButton>
            </div>
          </form>
        </Card>
      )}

      {/* Payments due */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">
          {isCleaner ? 'Owed to you' : 'Payments due'}
        </h2>
        {due.length === 0 ? (
          <EmptyState title="Nothing outstanding" description="Completed cleans with a set price show up here automatically." />
        ) : (
          <div className="space-y-2">
            {due.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{p.propertyName}</p>
                    <p className="mt-0.5 text-xs text-navy-500">
                      Due {fmtDate(p.dueDate)}
                      {p.fromJob && ' · from a completed clean'}
                      {p.reference && ` · ${p.reference}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tracking-tight text-navy-900">{formatMoney(p.amount)}</span>
                    <button
                      onClick={() => setPayingId(payingId === p.id ? null : p.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(20,184,166,0.55)] transition hover:-translate-y-px"
                    >
                      <Check className="h-4 w-4" /> Mark paid
                    </button>
                    <form action={deletePayment.bind(null, p.id)} onSubmit={confirmSubmit('Delete this payment?')}>
                      <button className="rounded-lg p-2 text-navy-400 transition hover:bg-coral-50 hover:text-coral-600" title="Delete" aria-label="Delete payment">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>

                {payingId === p.id && (
                  <form
                    action={markPaymentPaid.bind(null, p.id)}
                    className="mt-3 flex flex-wrap items-end gap-2 border-t border-sand-200 pt-3"
                  >
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-navy-600">Method</span>
                      <select name="method" className={cn(inputClass, 'w-40')} defaultValue={PaymentMethod.VENMO}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block flex-1">
                      <span className="mb-1 block text-xs font-medium text-navy-600">Reference (optional)</span>
                      <input name="reference" className={inputClass} placeholder="@handle · confirmation #" defaultValue={p.reference ?? ''} />
                    </label>
                    <SubmitButton pendingText="Saving…">Confirm paid</SubmitButton>
                  </form>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Settled payments */}
      {settled.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">
            {isCleaner ? 'Received' : 'Paid'}
          </h2>
          <div className="space-y-2">
            {settled.map((p) => {
              const meta = PAYMENT_STATUS_META[p.status];
              return (
                <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{p.propertyName}</p>
                    <p className="mt-0.5 text-xs text-navy-500">
                      {p.status === PaymentStatus.PAID ? `Paid ${fmtDate(p.paidAt)}` : 'Canceled'}
                      {p.method && ` · ${PAYMENT_METHOD_LABEL[p.method]}`}
                      {p.reference && ` · ${p.reference}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', meta.chip)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} /> {meta.label}
                    </span>
                    <span className="text-lg font-bold tracking-tight text-navy-900">{formatMoney(p.amount)}</span>
                    {p.status === PaymentStatus.PAID && (
                      <form action={markPaymentDue.bind(null, p.id)}>
                        <button className="rounded-lg p-2 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700" title="Mark as due again" aria-label="Undo paid">
                          <Undo2 className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                    <form action={deletePayment.bind(null, p.id)} onSubmit={confirmSubmit('Delete this payment?')}>
                      <button className="rounded-lg p-2 text-navy-400 transition hover:bg-coral-50 hover:text-coral-600" title="Delete" aria-label="Delete payment">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Expenses */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">Expenses</h2>
        {expenses.length === 0 ? (
          <EmptyState title="No expenses yet" description="Log supplies, repairs, and fees per property — attach a receipt if you have one." />
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => (
              <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">
                    {e.description}
                    <span className="ml-2 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-500">
                      {EXPENSE_CATEGORY_LABEL[e.category]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-navy-500">
                    {e.propertyName} · {fmtDate(e.incurredAt)}
                    {e.vendor && ` · ${e.vendor}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {e.receiptUrl && (
                    <a
                      href={e.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                    >
                      <Receipt className="h-4 w-4" /> Receipt <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <span className="text-lg font-bold tracking-tight text-navy-900">{formatMoney(e.amount)}</span>
                  <form action={deleteExpense.bind(null, e.id)} onSubmit={confirmSubmit('Delete this expense?')}>
                    <button className="rounded-lg p-2 text-navy-400 transition hover:bg-coral-50 hover:text-coral-600" title="Delete" aria-label="Delete expense">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Per-property breakdown */}
      {perProperty.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">By property</h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-4 py-2.5 font-semibold">Property</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{isCleaner ? 'Owed' : 'Due'}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{isCleaner ? 'Received' : 'Paid'}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {perProperty.map((r) => (
                  <tr key={r.propertyId} className="border-b border-sand-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-navy-800">{r.name}</td>
                    <td className="px-4 py-2.5 text-right text-amber-700 dark:text-amber-300">{r.due ? formatMoney(r.due) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-status-completed dark:text-brand-300">{r.paid ? formatMoney(r.paid) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-coral-600 dark:text-coral-300">{r.expenses ? formatMoney(r.expenses) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}
