'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Brush,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Home,
  Sparkles,
  Sun,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button, Card, LinkButton, StatTile } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * The kick-the-tires demo: the product's core flows on in-memory sample data,
 * no account required. Both views share one state tree on purpose — complete a
 * job as the cleaner and the host's stats, payments, and job list update live,
 * which IS the pitch.
 */

type DemoJob = {
  id: string;
  property: string;
  when: string;
  day: 'Today' | 'Tomorrow';
  sameDay: boolean;
  status: 'SCHEDULED' | 'COMPLETED';
  price: number;
  paid: boolean;
  photos: number;
  checklist: { label: string; done: boolean }[];
};

const INITIAL_JOBS: DemoJob[] = [
  {
    id: 'seaside',
    property: 'Seaside Cottage',
    when: 'Clean 10:00a → next guest 4:00p',
    day: 'Today',
    sameDay: true,
    status: 'SCHEDULED',
    price: 140,
    paid: false,
    photos: 0,
    checklist: [
      { label: 'Strip & remake all beds', done: false },
      { label: 'Bathrooms: towels, paper, wipe-down', done: false },
      { label: 'Kitchen: dishes away, counters, fridge check', done: false },
      { label: 'Restock coffee & paper goods', done: false },
      { label: 'Lock windows, set AC to 74°', done: false },
    ],
  },
  {
    id: 'dune',
    property: 'Dune Retreat',
    when: 'Checkout 11:00a · next guest Fri',
    day: 'Today',
    sameDay: false,
    status: 'SCHEDULED',
    price: 120,
    paid: false,
    photos: 0,
    checklist: [
      { label: 'Strip & remake all beds', done: false },
      { label: 'Bathrooms: towels, paper, wipe-down', done: false },
      { label: 'Sweep sand off deck & rinse outdoor shower', done: false },
    ],
  },
  {
    id: 'pelican',
    property: 'Pelican Perch',
    when: 'Checkout 10:00a',
    day: 'Tomorrow',
    sameDay: false,
    status: 'SCHEDULED',
    price: 180,
    paid: false,
    photos: 0,
    checklist: [
      { label: 'Strip & remake all beds', done: false },
      { label: 'Bathrooms: towels, paper, wipe-down', done: false },
      { label: 'Grill: brush grates, check propane', done: false },
      { label: 'Restock beach towels (6)', done: false },
    ],
  },
  {
    id: 'gull',
    property: 'Gull Cottage',
    when: 'Completed yesterday · 3 photos',
    day: 'Today',
    sameDay: false,
    status: 'COMPLETED',
    price: 130,
    paid: false,
    photos: 3,
    checklist: [
      { label: 'Strip & remake all beds', done: true },
      { label: 'Bathrooms: towels, paper, wipe-down', done: true },
      { label: 'Restock coffee & paper goods', done: true },
    ],
  },
];

export function DemoApp() {
  const [view, setView] = useState<'host' | 'cleaner'>('cleaner');
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [openId, setOpenId] = useState<string | null>('seaside');

  const stats = useMemo(() => {
    const today = jobs.filter((j) => j.day === 'Today');
    return {
      today: today.length,
      sameDay: today.filter((j) => j.sameDay && j.status !== 'COMPLETED').length,
      completed: jobs.filter((j) => j.status === 'COMPLETED').length,
      outstanding: jobs
        .filter((j) => j.status === 'COMPLETED' && !j.paid)
        .reduce((sum, j) => sum + j.price, 0),
    };
  }, [jobs]);

  const patchJob = (id: string, patch: (j: DemoJob) => DemoJob) =>
    setJobs((all) => all.map((j) => (j.id === id ? patch(j) : j)));

  const toggleItem = (id: string, idx: number) =>
    patchJob(id, (j) => ({
      ...j,
      checklist: j.checklist.map((c, i) => (i === idx ? { ...c, done: !c.done } : c)),
    }));

  const addPhoto = (id: string) => patchJob(id, (j) => ({ ...j, photos: j.photos + 1 }));

  const complete = (id: string) => patchJob(id, (j) => ({ ...j, status: 'COMPLETED' }));

  const markPaid = (id: string) => patchJob(id, (j) => ({ ...j, paid: true }));

  return (
    <div className="app-bg min-h-screen">
      {/* demo chrome */}
      <header className="border-b border-sand-200 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <Link href="/" aria-label="Back to the Ready2Rent homepage">
            <Logo markClassName="h-7 w-7" className="text-base" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20 sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5" /> Live demo · sample data
            </span>
            <ThemeToggle className="rounded-lg p-2 text-navy-500 transition hover:bg-navy-50 hover:text-navy-800" />
            <LinkButton href="/signup" className="whitespace-nowrap">
              Start free <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
          Poke around — it&rsquo;s all live
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-navy-500">
          This is the real product on sample data. Nothing to set up, nothing is saved.{' '}
          <span className="font-semibold text-navy-700">
            Try it: in the Cleaner view, tick off Seaside Cottage&rsquo;s checklist, add photos, and
            mark it complete — then flip to the Host view and watch the numbers move.
          </span>
        </p>

        {/* view switcher */}
        <div className="mt-6 inline-flex rounded-xl bg-navy-50 p-1 ring-1 ring-inset ring-navy-100">
          {(
            [
              { id: 'cleaner', label: 'Cleaner view', icon: <Brush className="h-4 w-4" /> },
              { id: 'host', label: 'Host view', icon: <Home className="h-4 w-4" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
                view === t.id
                  ? 'bg-surface text-navy-900 shadow-sm'
                  : 'text-navy-500 hover:text-navy-800',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* stat row */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={<Sun className="h-5 w-5" />} label="Turnovers today" value={stats.today} tone="teal" />
          <StatTile icon={<Sparkles className="h-5 w-5" />} label="Same-day" value={stats.sameDay} tone="coral" />
          <StatTile icon={<CheckCircle2 className="h-5 w-5" />} label="Completed" value={stats.completed} tone="green" />
          <StatTile
            icon={<CircleDollarSign className="h-5 w-5" />}
            label={view === 'cleaner' ? "You're owed" : 'Outstanding'}
            value={`$${stats.outstanding}`}
            tone="amber"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* job list */}
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                view={view}
                open={openId === job.id}
                onToggle={() => setOpenId(openId === job.id ? null : job.id)}
                onTickItem={(idx) => toggleItem(job.id, idx)}
                onAddPhoto={() => addPhoto(job.id)}
                onComplete={() => complete(job.id)}
              />
            ))}
          </div>

          {/* payments panel */}
          <div className="space-y-4">
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider text-navy-400">
                {view === 'cleaner' ? 'Owed to you' : 'Payments'}
              </p>
              <div className="mt-3 space-y-2.5">
                {jobs.filter((j) => j.status === 'COMPLETED').length === 0 && (
                  <p className="text-sm text-navy-400">No completed cleans yet.</p>
                )}
                {jobs
                  .filter((j) => j.status === 'COMPLETED')
                  .map((j) => (
                    <div key={j.id} className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{j.property}</p>
                        <p className="text-xs text-navy-400">Turnover clean</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-navy-900">${j.price}</span>
                        {j.paid ? (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                            Paid
                          </span>
                        ) : view === 'host' ? (
                          <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => markPaid(j.id)}>
                            Mark paid
                          </Button>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            Due
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              <p className="mt-4 border-t border-sand-100 pt-3 text-xs leading-relaxed text-navy-400">
                Completing a clean logs a payment due automatically — the amount comes from the
                property&rsquo;s cleaning price.
              </p>
            </Card>

            <Card className="bg-gradient-to-br from-brand-50 to-sky-50 dark:from-navy-50 dark:to-navy-50">
              <p className="font-bold text-navy-900">This synced itself.</p>
              <p className="mt-1.5 text-sm leading-relaxed text-navy-600">
                In your account, these jobs appear straight from your Airbnb or Vrbo calendar — and
                keep themselves up to date. Connecting takes about 2 minutes.
              </p>
              <LinkButton href="/signup" className="mt-4 w-full">
                Connect your calendar <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function JobRow({
  job,
  view,
  open,
  onToggle,
  onTickItem,
  onAddPhoto,
  onComplete,
}: {
  job: DemoJob;
  view: 'host' | 'cleaner';
  open: boolean;
  onToggle: () => void;
  onTickItem: (idx: number) => void;
  onAddPhoto: () => void;
  onComplete: () => void;
}) {
  const done = job.checklist.filter((c) => c.done).length;
  const allDone = done === job.checklist.length;
  const completed = job.status === 'COMPLETED';

  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={onToggle} className="relative flex w-full items-center justify-between gap-3 p-4 pl-5 text-left">
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b',
            completed
              ? 'from-brand-400 to-brand-600'
              : job.sameDay
                ? 'from-coral-400 to-coral-600'
                : 'from-sky-400 to-sky-600',
          )}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-navy-900">{job.property}</p>
            {completed ? (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">Completed</span>
            ) : job.sameDay ? (
              <span className="rounded-full bg-coral-50 px-2 py-0.5 text-[11px] font-bold text-coral-600">Same-day</span>
            ) : (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">Scheduled</span>
            )}
            <span className="text-xs font-medium text-navy-400">{job.day}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-navy-500">{job.when}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs font-semibold text-navy-400 sm:block">
            {done}/{job.checklist.length} · {job.photos} 📷
          </span>
          <ChevronDown className={cn('h-4 w-4 text-navy-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="border-t border-sand-100 p-4 pl-5">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-400">Checklist</p>
          <ul className="mt-2 space-y-1.5">
            {job.checklist.map((item, idx) => (
              <li key={item.label}>
                {view === 'cleaner' && !completed ? (
                  <button
                    type="button"
                    onClick={() => onTickItem(idx)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-sand-50"
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition',
                        item.done ? 'bg-brand-500 ring-brand-500' : 'bg-surface ring-navy-200',
                      )}
                    >
                      {item.done && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </span>
                    <span className={cn('text-navy-700', item.done && 'text-navy-400 line-through')}>{item.label}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5 px-2 py-1.5 text-sm">
                    <CheckCircle2 className={cn('h-4 w-4 shrink-0', item.done ? 'text-brand-500' : 'text-navy-200')} />
                    <span className={cn(item.done ? 'text-navy-400 line-through' : 'text-navy-700')}>{item.label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-navy-400">Photo proof</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {Array.from({ length: job.photos }).map((_, i) => (
              <span
                key={i}
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-sky-100 text-brand-700 ring-1 ring-inset ring-brand-600/15 dark:from-navy-50 dark:to-navy-100"
              >
                <Camera className="h-4 w-4" />
              </span>
            ))}
            {view === 'cleaner' && !completed && (
              <button
                type="button"
                onClick={onAddPhoto}
                className="flex h-12 items-center gap-1.5 rounded-lg border border-dashed border-navy-300 px-3 text-xs font-semibold text-navy-500 transition hover:border-brand-500 hover:text-brand-700"
              >
                <Camera className="h-4 w-4" /> Add photo
              </button>
            )}
            {view === 'host' && job.photos === 0 && (
              <p className="text-sm text-navy-400">No photos yet — they appear here the moment your cleaner uploads.</p>
            )}
          </div>

          {view === 'cleaner' && !completed && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-sand-100 pt-4">
              <Button onClick={onComplete} disabled={!allDone || job.photos === 0}>
                <CheckCircle2 className="h-4 w-4" /> Mark complete
              </Button>
              <p className="text-xs text-navy-400">
                {allDone && job.photos > 0
                  ? `Completing logs a $${job.price} payment due for the host.`
                  : 'Finish the checklist and add at least one photo first — hosts love that part.'}
              </p>
            </div>
          )}
          {completed && (
            <p className="mt-4 flex items-center gap-2 border-t border-sand-100 pt-4 text-sm font-medium text-brand-700">
              <CheckCircle2 className="h-4 w-4" /> Done — a ${job.price} payment due was logged
              {view === 'host' ? ' for you to settle.' : ' for this clean.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
