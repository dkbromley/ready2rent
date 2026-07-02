import Link from 'next/link';
import { Check, Plus, CalendarSync, Sparkles, ArrowRight } from 'lucide-react';
import type { OnboardingState } from '@/server/onboarding';
import { cn } from '@/lib/utils';

interface StepDef {
  title: string;
  desc: string;
  done: boolean;
  icon: React.ReactNode;
  cta?: { label: string; href: string };
}

/** Guided first-run setup for hosts. Renders only until all steps are done. */
export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  if (state.complete) return null;

  const steps: StepDef[] = [
    {
      title: 'Add your first property',
      desc: 'Name, address, and default checkout / check-in times.',
      done: state.hasProperty,
      icon: <Plus className="h-4 w-4" />,
      cta: state.hasProperty ? undefined : { label: 'Add property', href: '/properties/new' },
    },
    {
      title: 'Connect a calendar',
      desc: 'Paste your Airbnb or Vrbo iCal link — no password needed.',
      done: state.hasFeed,
      icon: <CalendarSync className="h-4 w-4" />,
      cta:
        !state.hasFeed && state.firstPropertyId
          ? { label: 'Connect calendar', href: `/properties/${state.firstPropertyId}` }
          : !state.hasFeed
            ? { label: 'Add a property first', href: '/properties/new' }
            : undefined,
    },
    {
      title: 'Watch your turnovers appear',
      desc: 'We sync reservations into scheduled cleaning jobs automatically.',
      done: state.hasJob,
      icon: <Sparkles className="h-4 w-4" />,
      cta: state.hasJob ? { label: 'View turnovers', href: '/jobs' } : undefined,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="card mb-6 overflow-hidden p-0">
      <div className="ocean-hero flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-200">Get set up</p>
          <h2 className="text-lg font-extrabold tracking-tight text-white">
            {doneCount === 0 ? 'Welcome to Ready2Rent' : "You're almost there"}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold tracking-tight text-white">{doneCount}/3</p>
          <p className="text-[11px] text-white/70">steps done</p>
        </div>
      </div>

      <ol className="divide-y divide-sand-100">
        {steps.map((s) => (
          <li key={s.title} className="flex items-center gap-4 px-5 py-4">
            <span
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-inset',
                s.done
                  ? 'bg-brand-50 text-brand-600 ring-brand-600/20'
                  : 'bg-sand-50 text-navy-400 ring-sand-200',
              )}
            >
              {s.done ? <Check className="h-4 w-4" /> : s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-semibold', s.done ? 'text-navy-400 line-through' : 'text-navy-900')}>
                {s.title}
              </p>
              {!s.done && <p className="text-xs text-navy-500">{s.desc}</p>}
            </div>
            {s.cta && !s.done && (
              <Link
                href={s.cta.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition',
                  s === nextStep
                    ? 'bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-6px_rgba(20,184,166,0.55)] hover:-translate-y-px'
                    : 'text-navy-600 ring-1 ring-inset ring-navy-200 hover:bg-navy-50',
                )}
              >
                {s.cta.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
