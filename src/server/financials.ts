import { Prisma, PaymentStatus, UserRole } from '@prisma/client';
import { startOfMonth } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getUserOrgIds, type SessionUser } from '@/lib/rbac';

/** Prisma filter for properties the user may see (owner org, cleaner org, or
 * directly assigned). Admins see everything. */
async function accessiblePropertyWhere(user: SessionUser): Promise<Prisma.PropertyWhereInput> {
  if (user.role === UserRole.ADMIN) return {};
  const orgIds = await getUserOrgIds(user.id);
  return {
    OR: [
      { ownerOrganizationId: { in: orgIds } },
      { assignedCleanerOrganizationId: { in: orgIds } },
      { assignedCleanerUserId: user.id },
    ],
  };
}

export interface FinancialsData {
  role: UserRole;
  properties: { id: string; name: string; calendarColor: string | null }[];
  payments: Awaited<ReturnType<typeof loadPayments>>;
  expenses: Awaited<ReturnType<typeof loadExpenses>>;
  summary: { outstanding: number; paidThisMonth: number; expensesThisMonth: number };
  perProperty: {
    propertyId: string;
    name: string;
    calendarColor: string | null;
    due: number;
    paid: number;
    expenses: number;
  }[];
}

function loadPayments(propertyIds: string[]) {
  return prisma.payment.findMany({
    where: { propertyId: { in: propertyIds } },
    include: {
      property: {
        select: {
          name: true,
          calendarColor: true,
          // Fallback payee when the job carries no specific assignee.
          assignedCleanerUser: { select: { name: true, payoutMethod: true, payoutHandle: true } },
        },
      },
      job: {
        select: {
          id: true,
          checkoutDateTime: true,
          assignedUser: { select: { name: true, payoutMethod: true, payoutHandle: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'desc' }, { createdAt: 'desc' }],
  });
}

function loadExpenses(propertyIds: string[]) {
  return prisma.expense.findMany({
    where: { propertyId: { in: propertyIds } },
    include: { property: { select: { name: true, calendarColor: true } } },
    orderBy: { incurredAt: 'desc' },
  });
}

export async function getFinancials(user: SessionUser): Promise<FinancialsData> {
  const where = await accessiblePropertyWhere(user);
  const properties = await prisma.property.findMany({
    where,
    select: { id: true, name: true, calendarColor: true },
    orderBy: { name: 'asc' },
  });
  const ids = properties.map((p) => p.id);

  const [payments, expenses] = ids.length
    ? await Promise.all([loadPayments(ids), loadExpenses(ids)])
    : [[], []];

  const monthStart = startOfMonth(new Date());

  let outstanding = 0;
  let paidThisMonth = 0;
  let expensesThisMonth = 0;
  const per = new Map<string, { name: string; calendarColor: string | null; due: number; paid: number; expenses: number }>();
  for (const p of properties) per.set(p.id, { name: p.name, calendarColor: p.calendarColor, due: 0, paid: 0, expenses: 0 });

  for (const pay of payments) {
    const row = per.get(pay.propertyId);
    if (pay.status === 'DUE') {
      outstanding += pay.amount;
      if (row) row.due += pay.amount;
    } else if (pay.status === 'PAID') {
      if (row) row.paid += pay.amount;
      if (pay.paidAt && pay.paidAt >= monthStart) paidThisMonth += pay.amount;
    }
  }
  for (const ex of expenses) {
    const row = per.get(ex.propertyId);
    if (row) row.expenses += ex.amount;
    if (ex.incurredAt >= monthStart) expensesThisMonth += ex.amount;
  }

  const perProperty = properties
    .map((p) => ({ propertyId: p.id, ...per.get(p.id)! }))
    .filter((r) => r.due > 0 || r.paid > 0 || r.expenses > 0);

  return {
    role: user.role,
    properties,
    payments,
    expenses,
    summary: { outstanding, paidThisMonth, expensesThisMonth },
    perProperty,
  };
}

/** Total outstanding (status DUE) across a user's accessible properties. For the
 * dashboard summary tile. */
export async function getOutstandingForUser(user: SessionUser): Promise<number> {
  const where = await accessiblePropertyWhere(user);
  const props = await prisma.property.findMany({ where, select: { id: true } });
  const ids = props.map((p) => p.id);
  if (!ids.length) return 0;
  const agg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { propertyId: { in: ids }, status: PaymentStatus.DUE },
  });
  return agg._sum.amount ?? 0;
}

/** Due / paid / expense totals for a single property (property detail card).
 * Access is gated by the caller. */
export async function getPropertyFinancials(
  propertyId: string,
): Promise<{ due: number; paid: number; expenses: number }> {
  const [dueAgg, paidAgg, expAgg] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { propertyId, status: PaymentStatus.DUE } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { propertyId, status: PaymentStatus.PAID } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { propertyId } }),
  ]);
  return {
    due: dueAgg._sum.amount ?? 0,
    paid: paidAgg._sum.amount ?? 0,
    expenses: expAgg._sum.amount ?? 0,
  };
}
