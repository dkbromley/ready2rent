import Link from 'next/link';
import {
  CalendarSync,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  X,
  Home,
  Brush,
  Umbrella,
  Bike,
  BedDouble,
} from 'lucide-react';
import { LinkButton } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { HeroSyncDemo } from '@/components/marketing/HeroSyncDemo';
import { WaveDivider } from '@/components/marketing/WaveDivider';
import {
  CalendarSyncArt,
  JobTicketArt,
  ChecklistArt,
  PhotoProofArt,
  LinensArt,
  PaymentsArt,
} from '@/components/marketing/SpotArt';

export const metadata = {
  title: 'Vacation rental turnovers, finally in sync',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-sand-50">
      {/* ---- Hero band (dark ocean) ---- */}
      <div className="ocean-hero ocean-grain relative overflow-hidden">
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Logo tone="onDark" markClassName="h-8 w-8" className="text-lg" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-white/70 hover:text-white sm:block">Features</a>
            <a href="#pricing" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-white/70 hover:text-white sm:block">Pricing</a>
            <a href="#faq" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-white/70 hover:text-white md:block">FAQ</a>
            <ThemeToggle className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white" />
            <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-white/85 hover:text-white">Sign in</Link>
            <LinkButton href="/signup">Get started</LinkButton>
          </nav>
        </header>

        {/* decorative floating glows */}
        <div className="animate-float pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-10 sm:pt-16 lg:grid-cols-2 lg:pb-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-200 ring-1 ring-inset ring-white/20 backdrop-blur">
              <CalendarSync className="h-3.5 w-3.5" /> Airbnb &amp; Vrbo calendar sync
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              From checkout to clean —{' '}
              <span className="inline-block bg-gradient-to-r from-brand-300 to-sky-300 bg-clip-text pb-[0.12em] text-transparent">
                and everything in between.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70">
              Ready2Rent pulls reservations straight from your booking calendars and turns every
              checkout into a scheduled turnover job — with checklists, photo proof, and payment
              tracking your whole crew stays on top of.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/signup" className="px-5 py-2.5 text-base">
                Start free <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-base font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/10"
              >
                Try the live demo
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
              {['No Airbnb password needed', 'Works with any iCal link', 'Same-day turnover alerts'].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-brand-300" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Animated product preview: reservation → sync → turnover job */}
          <div className="relative">
            <HeroSyncDemo />
            <p className="mt-3 text-center text-sm text-white/50">
              This is the real loop — watch it run on sample data in the{' '}
              <Link href="/demo" className="font-semibold text-brand-300 underline-offset-2 hover:underline">
                live demo
              </Link>
              .
            </p>
          </div>
        </div>

        {/* ocean eases into the sand */}
        <WaveDivider className="relative z-10 text-surface" />
      </div>

      {/* ---- Fact strip (all true, all concrete) ---- */}
      <div className="border-b border-sand-200 bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4">
          {[
            { k: '1 link', v: 'is the whole setup — your calendar’s iCal export' },
            { k: '0 passwords', v: 'we never touch your Airbnb or Vrbo login' },
            { k: 'Every 15 min', v: 'calendars re-checked, jobs kept in sync' },
            { k: 'Every clean', v: 'checklist-backed with photo proof' },
          ].map((s) => (
            <div key={s.k}>
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
            <Feature art={<CalendarSyncArt />} title="Auto calendar sync" desc="Reservations become turnover jobs on a recurring schedule. Dates move or cancel? Jobs update themselves." />
            <Feature art={<JobTicketArt />} title="Jobs, not texts" desc="Every checkout is a job with the window, notes, and status your cleaner actually needs." />
            <Feature art={<ChecklistArt />} title="Checklists" desc="Per-property checklists so nothing gets skipped — cleaners tick items off as they go." />
            <Feature art={<PhotoProofArt />} title="Photo proof & problems" desc="Completion photos and problem reports with images, so hosts see the state of every clean." />
            <Feature art={<LinensArt />} title="Inventory" desc="Track linens and supplies per property, with low-stock par levels." />
            <Feature art={<PaymentsArt />} title="Payments, zero fees" desc="Every clean logs what's due; settle it your way — Venmo, Zelle, Cash App, cash. The money never passes through us." />
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
              points={[
                'See every turnover with its exact window',
                'One-off, move-out & deep cleans on the same schedule',
                'Checklists and photo upload on your phone',
                'Get paid your way — never a fee on your pay',
              ]}
            />
          </div>
        </section>
      </main>

      {/* ---- Comparison: the real competitor is the group chat ---- */}
      <section className="border-y border-sand-200 bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Why switch</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900">Retire the group chat</h2>
            <p className="mt-3 text-navy-500">
              Your real competition isn&rsquo;t software — it&rsquo;s &ldquo;Cleaned&nbsp;✅&rdquo; buried in a text
              thread. Here&rsquo;s what changes.
            </p>
          </div>
          <div className="card mx-auto mt-10 max-w-4xl divide-y divide-sand-100 overflow-hidden p-0">
            <div className="hidden grid-cols-3 gap-4 bg-sand-50 px-6 py-3 md:grid">
              <p className="text-xs font-bold uppercase tracking-wider text-navy-400">When…</p>
              <p className="text-xs font-bold uppercase tracking-wider text-navy-400">With group texts</p>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">With Ready2Rent</p>
            </div>
            {[
              {
                when: 'A guest moves their booking',
                old: 'Someone has to notice, then re-text everyone',
                now: 'The job moves itself — flagged same-day if the gap is tight',
              },
              {
                when: 'You ask “was it cleaned?”',
                old: 'A thumbs-up emoji and good faith',
                now: 'Photo proof and a ticked checklist on every job',
              },
              {
                when: 'It’s time to settle up',
                old: 'A notes-app tally and Venmo detective work',
                now: 'Every completed clean logs a payment due, per property',
              },
              {
                when: 'A new cleaner starts',
                old: 'Forward months of screenshots',
                now: 'One invite — the whole schedule is already there',
              },
            ].map((r) => (
              <div key={r.when} className="grid gap-2 px-6 py-4 md:grid-cols-3 md:gap-4">
                <p className="text-sm font-semibold text-navy-900">{r.when}</p>
                <p className="flex items-start gap-2 text-sm text-navy-400">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-navy-300" /> {r.old}
                </p>
                <p className="flex items-start gap-2 text-sm text-navy-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {r.now}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Payment freedom ---- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Your money is yours</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900">
            We charge for software — never a cut of your pay
          </h2>
          <p className="mt-3 text-navy-500">
            Other platforms skim processing fees off every clean, hold payouts, and bill cleaners for
            background checks. Ready2Rent never touches the money.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Feature
            art={<PaymentsArt />}
            title="Paid your way"
            desc="Cleaners set how they want to be paid — Venmo, Zelle, Cash App, Apple Pay, or cash — and every payment a host owes shows that handle."
          />
          <Feature
            art={<JobTicketArt />}
            title="One tap to pay, zero fees"
            desc="Hosts get a Pay button that opens their payment app with the amount and note prefilled. No processing fees, no payout holds, no middleman."
          />
          <Feature
            art={<PhotoProofArt />}
            title="Two-sided receipts"
            desc="Host marks it paid, cleaner confirms it arrived — a payment log tied to the job and its photo proof. Evidence beats escrow."
          />
        </div>
        <p className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-navy-500">
          {['No payment processing fees', 'No payout holds', 'No charging cleaners for background checks'].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-brand-500" /> {t}
            </span>
          ))}
        </p>
      </section>

      {/* ---- Pricing ---- */}
      <section id="pricing" className="border-t border-sand-200 bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Pricing</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900">
              Software fees, not wage fees.
            </h2>
            <p className="mt-3 text-navy-500">
              Ready2Rent is in early access — everything below is free right now. Sign up today and
              you lock in early-access pricing when billing launches.
            </p>
          </div>

          <p className="mt-10 text-xs font-bold uppercase tracking-wider text-navy-400">For cleaning pros</p>
          <div className="mt-3 grid gap-5 md:grid-cols-3">
            <PricingCard
              tag="Cleaners · Free"
              price="$0"
              cadence="forever"
              blurb="Everything involved in working with your hosts. Never a fee to get paid."
              points={[
                'Turnovers synced from host calendars',
                'Checklists & photo proof on your phone',
                'Track what you’re owed, per host',
                'Payout profile — get paid your way',
              ]}
              cta="Join free"
            />
            <PricingCard
              highlight
              tag="Cleaners · Pro"
              price="$12"
              cadence="per month"
              blurb="Everything involved in running your business."
              points={[
                'Everything in Free',
                'One-off, move-out & deep cleans with per-job pricing',
                'Client scheduling beyond vacation rentals',
                'Business page & booking requests (coming soon)',
              ]}
              cta="Start free"
            />
            <PricingCard
              tag="Crew"
              price="$39"
              cadence="per month, whole team"
              blurb="For cleaning companies: run the roster, own your Saturday."
              points={[
                'Everything in Pro for every teammate',
                'Invite your team & hand off jobs',
                'Per-cleaner cleans and earnings',
                'Turnover Day board & run sheets (coming soon)',
              ]}
              cta="Start free"
            />
          </div>

          <p className="mt-10 text-xs font-bold uppercase tracking-wider text-navy-400">For hosts</p>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <PricingCard
              tag="Hosts · Starter"
              price="Free"
              cadence="1 property"
              blurb="The full turnover engine for your first door."
              points={[
                'Airbnb & Vrbo calendar sync',
                'Same-day turnover alerts',
                'Checklists, photo proof & problem reports',
                'Payment tracking with one-tap pay',
              ]}
              cta="Start free"
            />
            <PricingCard
              tag="Hosts · Pro"
              price="$9"
              cadence="per property / month"
              blurb="Every door you manage — capped at $49/mo, no matter how many."
              points={[
                'Everything in Starter, unlimited properties',
                'Financials: expenses, receipts & statements',
                'Inventory with low-stock alerts',
                'Priority support',
              ]}
              cta="Start free"
            />
          </div>
        </div>
      </section>

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

      {/* ---- FAQ ---- */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">FAQ</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900">
            The questions every host asks
          </h2>
        </div>
        <div className="card mt-10 divide-y divide-sand-100 p-0">
          <Faq q="Do you need my Airbnb or Vrbo password?">
            No — and we never ask. You paste the calendar&rsquo;s public iCal export link (Airbnb and
            Vrbo both provide one). It&rsquo;s read-only, you can revoke it any time from the booking
            platform, and we store it encrypted.
          </Faq>
          <Faq q="How do reservations become cleaning jobs?">
            We re-check your calendars about every 15 minutes. Each reservation becomes exactly one
            turnover job anchored to the checkout time, and we look ahead to the next check-in — if a
            new guest arrives the same day, the job is flagged so your cleaner knows the window is
            tight.
          </Faq>
          <Faq q="What happens when a booking changes or cancels?">
            The job updates itself. Date changes move the job automatically, and if a reservation
            disappears from the feed, the job is canceled (completed work and history are never
            deleted). If you complete or cancel something by hand, a later sync won&rsquo;t undo it.
          </Faq>
          <Faq q="What do cleaners get — and what does it cost them?">
            Nothing, ever — Ready2Rent is free for cleaning crews. Cleaners see every turnover with
            its exact window, tick off per-property checklists, upload completion photos and problem
            reports from their phone, and track what they&rsquo;re owed across every host they work
            with. Cleaners can even add properties and invite their hosts.
          </Faq>
          <Faq q="Does it handle payments? Do you take a cut?">
            We track, you pay — and we never take a cut. Completing a clean automatically logs a
            payment due, the cleaner&rsquo;s payout profile tells the host how they like to be paid
            (Venmo, Zelle, Cash App, Apple Pay, cash), and Venmo/Cash App handles become one-tap Pay
            buttons with the amount prefilled. The host marks it paid, the cleaner confirms it
            arrived, and the receipt lives next to the job&rsquo;s photo proof. No processing fees,
            no payout holds, ever.
          </Faq>
          <Faq q="Can I run my cleaning team on it?">
            Yes. Invite teammates to your cleaning company by email, hand any job to a specific
            cleaner, and see per-person cleans and earnings for the month. Each teammate gets their
            own schedule, checklists, and photo upload — and one-off, move-out, and deep cleans
            live on the same calendar as your turnovers.
          </Faq>
          <Faq q="What does it cost?">
            During early access, everything is free. Planned pricing: cleaners are free forever for
            everything involved in working with hosts; Cleaner Pro is $12/month for
            business features like one-off client jobs; Crew is $39/month flat for a whole cleaning
            company. Hosts: first property free, then $9 per property per month capped at $49.
            Early-access users lock in their pricing when billing launches — and no plan ever takes
            a percentage of a payment.
          </Faq>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="mx-auto max-w-6xl px-6 pb-16 sm:pb-20">
        <div className="ocean-hero ocean-grain relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="pointer-events-none absolute -right-16 -top-10 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl" />
          <WaveDivider className="pointer-events-none absolute inset-x-0 bottom-0 text-white/[0.06]" />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            From checkout to clean — automatically.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/70">
            Connect a calendar and watch your first turnover jobs appear in minutes.
          </p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/signup" className="px-6 py-3 text-base">
              Get started free <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/10"
            >
              Try the live demo
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-sand-200 bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
          <div>
            <Logo markClassName="h-6 w-6" className="text-sm text-navy-700" />
            <p className="mt-2 max-w-xs text-sm text-navy-500">
              From checkout to clean — and everything in between.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
              { label: 'Live demo', href: '/demo' },
            ]}
          />
          <FooterCol
            title="Get started"
            links={[
              { label: 'Create an account', href: '/signup' },
              { label: 'Sign in', href: '/login' },
            ]}
          />
        </div>
        <div className="border-t border-sand-100">
          <p className="mx-auto max-w-6xl px-6 py-4 text-xs text-navy-400">
            © {new Date().getFullYear()} Ready2Rent
          </p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ art, title, desc }: { art: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-5 transition duration-150 hover:-translate-y-0.5 hover:shadow-card-hover">
      {art}
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

function PricingCard({
  tag,
  price,
  cadence,
  blurb,
  points,
  cta,
  highlight = false,
}: {
  tag: string;
  price: string;
  cadence: string;
  blurb: string;
  points: string[];
  cta: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? 'card relative flex flex-col p-7 ring-2 ring-brand-500'
          : 'card relative flex flex-col p-7'
      }
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
          Most popular
        </span>
      )}
      <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{tag}</p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight text-navy-900">{price}</span>
        <span className="text-sm font-medium text-navy-400">{cadence}</span>
      </p>
      <p className="mt-2 text-sm text-navy-500">{blurb}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-navy-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {p}
          </li>
        ))}
      </ul>
      <LinkButton
        href="/signup"
        variant={highlight ? 'primary' : 'secondary'}
        className="mt-6 w-full"
      >
        {cta}
      </LinkButton>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group px-6 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-navy-900 [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-navy-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-navy-500">{children}</p>
    </details>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-navy-400">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.href.startsWith('#') ? (
              <a href={l.href} className="text-sm text-navy-600 hover:text-brand-700">{l.label}</a>
            ) : (
              <Link href={l.href} className="text-sm text-navy-600 hover:text-brand-700">{l.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
