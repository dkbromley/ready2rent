import { CalendarCheck2 } from 'lucide-react';
import { DashboardGreeting } from './DashboardGreeting';

/**
 * The dashboard's greeting band: time-of-day greeting, a one-sentence summary
 * of the day, role-specific quick actions, and a progress ring of today's
 * cleans. The one ocean-brand surface inside the app.
 *
 * The date + greeting are rendered client-side (DashboardGreeting) so they
 * track the viewer's real local time; `dateLabel`/`greeting` are the
 * server-computed fallbacks (in the user's saved timezone).
 */
export function DashboardHero({
  name,
  dateLabel,
  greeting,
  summary,
  doneToday,
  totalToday,
  actions,
}: {
  name: string | null | undefined;
  dateLabel: string;
  greeting: string;
  summary: string;
  doneToday: number;
  totalToday: number;
  actions?: React.ReactNode;
}) {
  return (
    <div className="ocean-hero ocean-grain relative mb-6 overflow-hidden rounded-3xl">
      <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-6 px-6 py-6 sm:flex-row sm:items-center sm:px-8">
        <div className="min-w-0">
          <DashboardGreeting name={name} fallbackDate={dateLabel} fallbackGreeting={greeting} />
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">{summary}</p>
          {actions && <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>

        <div className="shrink-0 sm:pr-2">
          {totalToday > 0 ? (
            <ProgressRing done={doneToday} total={totalToday} />
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 backdrop-blur">
              <CalendarCheck2 className="h-6 w-6 text-brand-300" />
              <div>
                <p className="text-sm font-bold text-white">Clear day</p>
                <p className="text-xs text-white/60">No turnovers today</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Donut of today's completed cleans, sized for the hero band. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, done / Math.max(1, total));
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 backdrop-blur">
      <svg viewBox="0 0 76 76" className="h-16 w-16 -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div>
        <p className="text-xl font-extrabold tracking-tight text-white">
          {done}<span className="text-white/50">/{total}</span>
        </p>
        <p className="text-xs text-white/60">cleans done today</p>
      </div>
    </div>
  );
}
