'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Check, Moon, RefreshCw, Sun } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { cn } from '@/lib/utils';

/**
 * The hero's product preview, animated: a reservation lands in the booking
 * feed, a sync pulse travels down, and it becomes a turnover job on the
 * dashboard — the product's core loop, shown instead of described.
 *
 * Loops through four phases; with prefers-reduced-motion it rests on the
 * final "synced" state. A mini sun/moon toggle rethemes just the dashboard
 * panel (via the token layer) to show off dark mode without leaving the page.
 */

const PHASES = ['idle', 'booked', 'sync', 'job'] as const;
type Phase = (typeof PHASES)[number];
const DURATIONS: Record<Phase, number> = { idle: 1500, booked: 1700, sync: 1400, job: 4600 };

export function HeroSyncDemo() {
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);
  // null = follow the page theme until the visitor touches the mini toggle.
  const [panelTheme, setPanelTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced) {
      setStep(PHASES.indexOf('job'));
      return;
    }
    const t = setTimeout(() => setStep((s) => (s + 1) % PHASES.length), DURATIONS[PHASES[step]]);
    return () => clearTimeout(t);
  }, [step, reduced]);

  const phase = PHASES[step];
  const reached = (p: Phase) => step >= PHASES.indexOf(p);
  const synced = reached('job');

  const togglePanelTheme = () =>
    setPanelTheme((t) =>
      t ? (t === 'dark' ? 'light' : 'dark')
        : document.documentElement.classList.contains('dark') ? 'light' : 'dark',
    );

  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
      {/* frame header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Live preview</p>
        <button
          type="button"
          onClick={togglePanelTheme}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Toggle the preview between light and dark mode"
        >
          {panelTheme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {panelTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      {/* booking feed */}
      <div className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-inset ring-white/10">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-white/80">
            <span className="h-2 w-2 rounded-full bg-[#FF5A5F]" /> Airbnb · iCal feed
          </p>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[11px] font-semibold',
              phase === 'sync' ? 'text-brand-300' : synced ? 'text-brand-300' : 'text-white/50',
            )}
          >
            {phase === 'idle' && 'Watching for changes…'}
            {phase === 'booked' && 'New reservation'}
            {phase === 'sync' && (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" /> Syncing…
              </>
            )}
            {phase === 'job' && (
              <>
                <Check className="h-3 w-3" /> Synced
              </>
            )}
          </span>
        </div>
        <div className="mt-2 h-9">
          {reached('booked') ? (
            <div className="animate-drop-in flex h-9 items-center justify-between rounded-lg bg-white/[0.07] px-3 ring-1 ring-inset ring-white/10">
              <p className="inline-flex items-center gap-2 text-xs text-white/85">
                <CalendarDays className="h-3.5 w-3.5 text-white/50" /> Guest stay · Jul 5 → Jul 12
              </p>
              <span className="text-[11px] font-medium text-white/50">Seaside Cottage</span>
            </div>
          ) : (
            <div className="flex h-9 items-center rounded-lg px-3 ring-1 ring-inset ring-white/[0.06]">
              <span className="text-xs text-white/30">No changes since last sync</span>
            </div>
          )}
        </div>
      </div>

      {/* feed → dashboard connector */}
      <div className="relative mx-auto h-7 w-0.5 overflow-visible rounded bg-white/15">
        {phase === 'sync' && (
          <span className="animate-sync-pulse absolute -left-[3px] h-2 w-2 rounded-full bg-brand-300 shadow-[0_0_12px_2px_rgba(94,234,212,0.7)]" />
        )}
      </div>

      {/* dashboard — wrapped so the mini toggle rethemes only this panel */}
      <div className={panelTheme === 'dark' ? 'dark' : panelTheme === 'light' ? 'theme-light' : undefined}>
        <div className="rounded-xl bg-surface p-4 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Today · Sat Jul 12</p>
              <p className="text-lg font-extrabold tracking-tight text-navy-900">Turnover dashboard</p>
            </div>
            <LogoMark className="h-8 w-8 rounded-[9px]" />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { l: 'Properties', v: '6', c: 'text-navy-900' },
              { l: 'Same-day', v: synced ? '2' : '1', c: 'text-coral-600' },
              { l: 'Outstanding', v: '$480', c: 'text-amber-700' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-sand-100 bg-sand-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-navy-400">{s.l}</p>
                <p key={s.v} className={cn('animate-drop-in mt-0.5 text-lg font-extrabold tracking-tight', s.c)}>
                  {s.v}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            {/* Ghost + real card stacked in one grid cell so the slot's height
                is constant — the card fading in never reflows the hero. */}
            <div className="grid">
              <div
                className={cn(
                  'col-start-1 row-start-1 flex items-center justify-center rounded-xl border border-dashed border-sand-200 p-2.5 transition-opacity duration-300',
                  synced && 'opacity-0',
                )}
                aria-hidden="true"
              >
                <p className="text-[11px] text-navy-300">Next turnover appears here…</p>
              </div>
              <div
                className={cn(
                  'relative col-start-1 row-start-1 flex items-center justify-between overflow-hidden rounded-xl border border-sand-100 bg-surface p-2.5 pl-3.5',
                  synced ? 'animate-pop-in' : 'opacity-0',
                )}
              >
                <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-coral-400 to-coral-600" />
                <div>
                  <p className="text-sm font-semibold text-navy-900">Seaside Cottage</p>
                  <p className="text-[11px] text-navy-400">Clean 10:00a → next guest 4:00p</p>
                </div>
                <span className="rounded-full bg-coral-50 px-2 py-0.5 text-[10px] font-bold text-coral-600">
                  Same-day
                </span>
              </div>
            </div>
            <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-sand-100 bg-surface p-2.5 pl-3.5">
              <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-brand-400 to-brand-600" />
              <div>
                <p className="text-sm font-semibold text-navy-900">Dune Retreat</p>
                <p className="text-[11px] text-navy-400">Checkout 11:00a</p>
              </div>
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                Scheduled
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
