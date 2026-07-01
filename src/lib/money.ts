import { PaymentMethod, PaymentStatus, ExpenseCategory } from '@prisma/client';

/** Whole-dollar amounts (matching Property.cleaningPrice). "$1,250" / "—". */
export function formatMoney(dollars: number | null | undefined): string {
  if (dollars == null) return '—';
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(dollars)).toLocaleString('en-US')}`;
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  APPLE_PAY: 'Apple Pay',
  VENMO: 'Venmo',
  CASH_APP: 'Cash App',
  ZELLE: 'Zelle',
  CASH: 'Cash',
  OTHER: 'Other',
};

/** Order shown in method pickers. */
export const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.APPLE_PAY,
  PaymentMethod.VENMO,
  PaymentMethod.CASH_APP,
  PaymentMethod.ZELLE,
  PaymentMethod.CASH,
  PaymentMethod.OTHER,
];

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; dot: string; chip: string }> = {
  DUE: {
    label: 'Due',
    dot: 'bg-status-pending',
    chip: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  PAID: {
    label: 'Paid',
    dot: 'bg-status-completed',
    chip: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  },
  CANCELED: {
    label: 'Canceled',
    dot: 'bg-status-canceled',
    chip: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  },
};

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  SUPPLIES: 'Supplies',
  REPAIRS: 'Repairs',
  UTILITIES: 'Utilities',
  CLEANING: 'Cleaning',
  FEES: 'Fees',
  OTHER: 'Other',
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.SUPPLIES,
  ExpenseCategory.REPAIRS,
  ExpenseCategory.UTILITIES,
  ExpenseCategory.CLEANING,
  ExpenseCategory.FEES,
  ExpenseCategory.OTHER,
];
