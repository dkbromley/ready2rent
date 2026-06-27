import Link from 'next/link';
import {
  Waves,
  CalendarSync,
  Sparkles,
  BellRing,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { LinkButton } from '@/components/ui';

export default function LandingPage() {
  return (
    <div className="coastal-gradient min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-navy-900">
          <Waves className="h-6 w-6 text-brand-600" />
          TurnReady
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-navy-600 hover:bg-white/60">
            Sign in
          </Link>
          <LinkButton href="/signup">Get started</LinkButton>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="py-16 sm:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-600/20">
              <CalendarSync className="h-3.5 w-3.5" /> Airbnb &amp; Vrbo calendar sync
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-navy-900 sm:text-5xl">
              Vacation rental turnovers, finally in sync.
            </h1>
            <p className="mt-5 text-lg text-navy-600">
              TurnReady pulls your reservations straight from your booking calendars and turns
              every checkout into a scheduled cleaning job — automatically. From checkout to clean,
              without the texts.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/signup" className="px-5 py-2.5 text-base">
                Start free <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton href="/login" variant="secondary" className="px-5 py-2.5 text-base">
                I have an account
              </LinkButton>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-600">
              {['No Airbnb password needed', 'Works with iCal links', 'Same-day turnover alerts'].map(
                (item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-brand-600" /> {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid gap-5 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<CalendarSync className="h-5 w-5" />}
            title="Auto calendar sync"
            desc="Paste your Airbnb or Vrbo iCal link. We pull reservations on a recurring schedule — no scraping, no passwords."
          />
          <Feature
            icon={<Sparkles className="h-5 w-5" />}
            title="Jobs, not texts"
            desc="Every checkout becomes a turnover job with the window, notes, and status your cleaner actually needs."
          />
          <Feature
            icon={<BellRing className="h-5 w-5" />}
            title="Change-aware"
            desc="Dates move or a booking cancels? Jobs update automatically and everyone gets notified."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Same-day flags"
            desc="When a new guest checks in the same day, the tight turnover is highlighted so nothing slips."
          />
        </section>

        {/* How it works */}
        <section className="pb-24">
          <h2 className="text-center text-2xl font-bold text-navy-900">How it works</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <Step n={1} title="Add your property" desc="Name, address, bedrooms, and your default checkout & check-in times." />
            <Step n={2} title="Connect your calendar" desc="Paste the Airbnb/Vrbo iCal export link. We do the rest." />
            <Step n={3} title="Cleaners see the work" desc="Turnover jobs appear on your cleaner's dashboard, kept in sync." />
          </div>
        </section>
      </main>

      <footer className="border-t border-navy-100 bg-white/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-navy-500 sm:flex-row">
          <span className="inline-flex items-center gap-2 font-medium text-navy-700">
            <Waves className="h-4 w-4 text-brand-600" /> TurnReady
          </span>
          <span>From checkout to clean — without the texts.</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-5">
      <div className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700">{icon}</div>
      <h3 className="mt-3 font-semibold text-navy-900">{title}</h3>
      <p className="mt-1.5 text-sm text-navy-500">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="card p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {n}
      </div>
      <h3 className="mt-4 font-semibold text-navy-900">{title}</h3>
      <p className="mt-1.5 text-sm text-navy-500">{desc}</p>
    </div>
  );
}
