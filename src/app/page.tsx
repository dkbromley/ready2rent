import Link from 'next/link';
import {
  Waves,
  CalendarSync,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Camera,
  Boxes,
  Wallet,
  Home,
  Brush,
  Umbrella,
  Bike,
  BedDouble,
} from 'lucide-react';
import { LinkButton } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata = {
  title: 'Vacation rental turnovers, finally in sync',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-sand-50">
      {/* ---- Hero band (dark ocean) ---- */}
      <div className="ocean-hero relative overflow-hidden">
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-300 to-brand-600 shadow-[0_6px_16px_-4px_rgba(20,184,166,0.6)]">
              <Waves className="h-4 w-4" />
            </span>
            Ready2Rent
          </span>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-navy-200 hover:text-white sm:block">Features</a>
            <a href="#how" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-navy-200 hover:text-white sm:block">How it works</a>
            <ThemeToggle className="rounded-lg p-2 text-navy-200 transition hover:bg-white/10 hover:text-white" />
            <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-navy-100 hover:text-white">Sign in</Link>
            <LinkButton href="/signup">Get started</LinkButton>
          </nav>
        </header>

        {/* decorative floating glows */}
        <div className="animate-float pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-10 sm:pt-16 lg:grid-cols-2 lg:pb-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-200 ring-1 ring-inset ring-white/20 backdrop-blur">
              <CalendarSync className="h-3.5 w-3.5" /> Airbnb &amp; Vrbo calendar sync
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              Checkout to clean,{' '}
              <span className="bg-gradient-to-r from-brand-300 to-sky-300 bg-clip-text text-transparent">
                without the texts.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-200">
              Ready2Rent pulls reservations straight from your booking calendars and turns every
              checkout into a scheduled turnover job — with checklists, photo proof, and payment
              tracking your whole crew stays on top of.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/signup" className="px-5 py-2.5 text-base">
                Start free <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-base font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/10"
              >
                I have an account
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-200">
              {['No Airbnb password needed', 'Works with any iCal link', 'Same-day turnover alerts'].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-brand-300" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Product preview mockup */}
          <div className="relative">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
              <div className="rounded-xl bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Today · Sat Jul 5</p>
                    <p className="text-lg font-extrabold tracking-tight text-navy-900">Turnover dashboard</p>
                  </div>
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
                    <Waves className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { l: 'Properties', v: '6', c: 'text-navy-900' },
                    { l: 'Same-day', v: '2', c: 'text-coral-600' },
                    { l: 'Outstanding', v: '$480', c: 'text-amber-700' },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-sand-100 bg-sand-50 p-3">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-navy-400">{s.l}</p>
                      <p className={`mt-0.5 text-lg font-extrabold tracking-tight ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 space-y-2">
                  {[
                    { n: 'Seaside Cottage', t: '10:00a → 4:00p', tag: 'Same-day', tone: 'bg-coral-50 text-coral-600' },
                    { n: 'Dune Retreat', t: 'Checkout 11:00a', tag: 'Scheduled', tone: 'bg-sky-50 text-sky-700' },
                  ].map((j) => (
                    <div key={j.n} className="relative flex items-center justify-between overflow-hidden rounded-xl border border-sand-100 bg-surface p-2.5 pl-3.5">
                      <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-brand-400 to-brand-600" />
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{j.n}</p>
                        <p className="text-[11px] text-navy-400">{j.t}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${j.tone}`}>{j.tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Benefit strip ---- */}
      <div className="border-b border-sand-200 bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4">
          {[
            { k: 'Zero', v: 'missed turnovers' },
            { k: '1 link', v: 'to connect a calendar' },
            { k: 'Photos', v: 'as proof of every clean' },
            { k: 'Hosts + crews', v: 'on the same page' },
          ].map((s) => (
            <div key={s.v}>
              <p className="text-xl font-extrabold tracking-tight text-navy-900">{s.k}</p>
              <p className="text-sm text-navy-500">{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6">
        {/* ---- How it works ---- */}
        <section id="how" className="py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900">Live in three steps</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            <Step n={1} title="Add your property" desc="Name, address, bedrooms, and your default checkout & check-in times." />
            <Step n={2} title="Connect your calendar" desc="Paste the Airbnb/Vrbo iCal export link. We pull reservations on a schedule — no scraping, no passwords." />
            <Step n={3} title="Everyone sees the work" desc="Turnover jobs appear on your cleaner's dashboard with windows, checklists, and photo proof — kept in sync automatically." />
          </div>
        </section>

        {/* ---- Feature grid ---- */}
        <section id="features" className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Everything in one place</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900">Built for real turnover days</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={<CalendarSync className="h-5 w-5" />} title="Auto calendar sync" desc="Reservations become turnover jobs on a recurring schedule. Dates move or cancel? Jobs update themselves." />
            <Feature icon={<Sparkles className="h-5 w-5" />} title="Jobs, not texts" desc="Every checkout is a job with the window, notes, and status your cleaner actually needs." />
            <Feature icon={<ClipboardCheck className="h-5 w-5" />} title="Checklists" desc="Per-property checklists so nothing gets skipped — cleaners tick items off as they go." />
            <Feature icon={<Camera className="h-5 w-5" />} title="Photo proof & problems" desc="Completion photos and problem reports with images, so hosts see the state of every clean." />
            <Feature icon={<Boxes className="h-5 w-5" />} title="Inventory" desc="Track linens and supplies per property, with low-stock par levels." />
            <Feature icon={<Wallet className="h-5 w-5" />} title="Payment tracking" desc="Know what's due and paid per property and per clean — Apple Pay, Venmo, Cash App, Zelle." />
          </div>
        </section>

        {/* ---- Dual audience ---- */}
        <section className="pb-16 sm:pb-20">
          <div className="grid gap-5 md:grid-cols-2">
            <AudienceCard
              icon={<Home className="h-5 w-5" />}
              tag="For hosts"
              title="Never wonder if it got cleaned"
              points={['Same-day turnovers flagged automatically', 'Photo proof + problem reports for every clean', 'Outstanding payments and expenses at a glance']}
            />
            <AudienceCard
              icon={<Brush className="h-5 w-5" />}
              tag="For cleaners"
              title="Your whole schedule, synced"
              points={['See every turnover with its exact window', 'Checklists and photo upload on your phone', 'Track what you’re owed across every property']}
            />
          </div>
        </section>
      </main>

      {/* ---- Marketplace teaser ---- */}
      <section className="border-y border-sand-200 bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
                Coming soon
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-navy-900">
                One platform for the whole rental
              </h2>
              <p className="mt-2 text-navy-500">
                We’re opening Ready2Rent to local vendors — linen services and beach-gear rentals
                like bikes, chairs, and umbrellas — with a storefront hosts can book from in a click.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { icon: <BedDouble className="h-5 w-5" />, l: 'Linens' },
                { icon: <Bike className="h-5 w-5" />, l: 'Bikes' },
                { icon: <Umbrella className="h-5 w-5" />, l: 'Beach gear' },
              ].map((v) => (
                <div key={v.l} className="flex w-24 flex-col items-center gap-2 rounded-2xl border border-sand-200 bg-sand-50 p-4 text-navy-600">
                  <span className="text-brand-600">{v.icon}</span>
                  <span className="text-xs font-semibold">{v.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="ocean-hero relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="pointer-events-none absolute -right-16 -top-10 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            From checkout to clean — automatically.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-navy-200">
            Connect a calendar and watch your first turnover jobs appear in minutes.
          </p>
          <div className="relative mt-7 flex justify-center">
            <LinkButton href="/signup" className="px-6 py-3 text-base">
              Get started free <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
        </div>
      </section>

      <footer className="border-t border-sand-200 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-navy-500 sm:flex-row">
          <span className="inline-flex items-center gap-2 font-semibold text-navy-700">
            <Waves className="h-4 w-4 text-brand-600" /> Ready2Rent
          </span>
          <span>From checkout to clean — without the texts.</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-5 transition duration-150 hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700 ring-1 ring-inset ring-brand-600/15">{icon}</div>
      <h3 className="mt-3 font-bold text-navy-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-navy-500">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="card p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(20,184,166,0.6)]">
        {n}
      </div>
      <h3 className="mt-4 font-bold text-navy-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-navy-500">{desc}</p>
    </div>
  );
}

function AudienceCard({
  icon,
  tag,
  title,
  points,
}: {
  icon: React.ReactNode;
  tag: string;
  title: string;
  points: string[];
}) {
  return (
    <div className="card p-7">
      <div className="flex items-center gap-2">
        <span className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-700 ring-1 ring-inset ring-brand-600/15">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-brand-600">{tag}</span>
      </div>
      <h3 className="mt-4 text-xl font-extrabold tracking-tight text-navy-900">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-navy-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
