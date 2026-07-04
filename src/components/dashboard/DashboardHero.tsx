import { CalendarCheck2 } from 'lucide-react';

/**
 * The dashboard's greeting band: time-of-day greeting, a one-sentence summary
 * of the day, role-specific quick actions, and a progress ring of today's
 * cleans. The one ocean-brand surface inside the app.
 */
export function DashboardHero({
  name,
  dateLabel,
  summary,
  doneToday,
  totalToday,
  actions,
}: {
  name: string | null | undefined;
  dateLabel: string;
  summary: string;
  doneToday: number;
  totalToday: number;
  actions?: React.ReactNode;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up early' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <div className="ocean-hero ocean-grain relative mb-6 overflow-hidden rounded-3xl">
      <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-6 px-6 py-6 sm:flex-row sm:items-center sm:px-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-200">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h1>
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
