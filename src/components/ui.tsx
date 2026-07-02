import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Card surface. */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('card p-5', className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-navy-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-6px_rgba(20,184,166,0.55)] hover:from-brand-300 hover:to-brand-500 hover:-translate-y-px',
  secondary: 'bg-surface text-navy-800 ring-1 ring-inset ring-navy-200 hover:bg-navy-50 hover:-translate-y-px',
  ghost: 'text-navy-600 hover:bg-brand-50 hover:text-brand-700',
  danger: 'bg-status-problem text-white shadow-[0_8px_20px_-6px_rgba(207,84,48,0.55)] hover:bg-red-700',
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
        buttonStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition duration-150',
        buttonStyles[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  href?: string;
}) {
  const inner = (
    <div className="card p-5 transition hover:shadow-card-hover">
      <p className="text-sm font-medium text-navy-500">{label}</p>
      <p className={cn('mt-2 text-3xl font-bold tracking-tight', accent ?? 'text-navy-900')}>
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

type Tone = 'neutral' | 'teal' | 'coral' | 'green' | 'amber';
const TILE_ICON: Record<Tone, string> = {
  neutral: 'bg-navy-50 text-navy-500 ring-navy-600/10',
  teal: 'bg-brand-50 text-brand-700 ring-brand-600/15',
  coral: 'bg-coral-50 text-coral-600 ring-coral-600/15',
  green: 'bg-teal-50 text-status-completed ring-teal-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/15',
};
const TILE_VALUE: Record<Tone, string> = {
  neutral: 'text-navy-900',
  teal: 'text-navy-900',
  coral: 'text-coral-600',
  green: 'text-status-completed',
  amber: 'text-amber-700',
};

/** Summary tile: tinted icon chip, label, big value. The dashboard stat card. */
export function StatTile({
  icon,
  label,
  value,
  tone = 'neutral',
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const inner = (
    <div className="card h-full p-5 transition duration-150 hover:-translate-y-0.5 hover:shadow-card-hover">
      <span className={cn('inline-flex rounded-xl p-2.5 ring-1 ring-inset', TILE_ICON[tone])}>{icon}</span>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-navy-400">{label}</p>
      <p className={cn('mt-1 text-3xl font-extrabold tracking-tight', TILE_VALUE[tone])}>{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="text-base font-semibold text-navy-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-navy-500">{description}</p>}
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-navy-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border-0 bg-surface px-3 py-2 text-sm text-navy-900 shadow-sm ring-1 ring-inset ring-navy-200 placeholder:text-navy-300 focus:ring-2 focus:ring-inset focus:ring-brand-500';
