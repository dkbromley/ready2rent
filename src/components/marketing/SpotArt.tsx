import { cn } from '@/lib/utils';

/**
 * Hand-drawn spot illustrations for the marketing site — the coastal answer to
 * a generic icon library. Shared visual language: a soft seafoam wash behind a
 * currentColor line drawing (so they retheme in dark mode for free), with
 * seafoam + coral accents echoing the logo's wave motif.
 *
 * All are 48×48 viewBox, stroke 2.2, round caps — sized for the feature grid.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const BRAND = '#0d9488'; // brand-600
const BRAND_SOFT = '#2dd4bf'; // brand-400
const CORAL = '#cf5430'; // coral-500

function Blob() {
  // Organic two-tone wash; alpha-based so it sits well on light sand and dark ocean.
  return (
    <>
      <circle cx="26" cy="23" r="19" fill={BRAND_SOFT} opacity="0.14" />
      <circle cx="17" cy="30" r="12" fill="#38bdf8" opacity="0.1" />
    </>
  );
}

function Frame({ className, title, children }: { className?: string; title: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={title} className={cn('h-12 w-12 text-navy-800', className)}>
      <Blob />
      {children}
    </svg>
  );
}

/** Calendar page with sync arrows — reservations pulled on a schedule. */
export function CalendarSyncArt({ className }: { className?: string }) {
  return (
    <Frame className={className} title="Calendar sync">
      <g {...STROKE}>
        <rect x="9" y="11" width="30" height="27" rx="4" />
        <path d="M9 19h30" />
        <path d="M17 8v6M31 8v6" />
        {/* circular sync arrows */}
        <path d="M19 30.5a5.5 5.5 0 0 1 9.5-2.4" stroke={BRAND} />
        <path d="M29.5 25v3.4H26" stroke={BRAND} />
        <path d="M29 31.5a5.5 5.5 0 0 1-9.5 2.4" stroke={BRAND} />
        <path d="M18.5 37v-3.4H22" stroke={BRAND} />
      </g>
      <circle cx="35" cy="23.5" r="2" fill={CORAL} />
    </Frame>
  );
}

/** A job ticket with a time window — the thing a text thread never gives you. */
export function JobTicketArt({ className }: { className?: string }) {
  return (
    <Frame className={className} title="Turnover job">
      <g {...STROKE}>
        <rect x="9" y="12" width="30" height="25" rx="4" />
        <path d="M15 20h11M15 25h8" />
        {/* clock = the turnover window */}
        <circle cx="31.5" cy="28.5" r="5.5" stroke={BRAND} />
        <path d="M31.5 26v2.8l2 1.4" stroke={BRAND} />
      </g>
      {/* left accent bar, like the app's job cards */}
      <path d="M12 15.5v18" stroke={BRAND_SOFT} strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

/** Clipboard checklist: two done, one to go. */
export function ChecklistArt({ className }: { className?: string }) {
  return (
    <Frame className={className} title="Checklists">
      <g {...STROKE}>
        <rect x="11" y="10" width="26" height="30" rx="4" />
        <path d="M19 10.5V8h10v2.5" />
        <path d="M17 19.5l2.2 2.2 4-4.2" stroke={BRAND} />
        <path d="M27.5 20.5H32" />
        <path d="M17 27.5l2.2 2.2 4-4.2" stroke={BRAND} />
        <path d="M27.5 28.5H32" />
        <circle cx="19.5" cy="35" r="2.2" stroke={CORAL} />
        <path d="M27.5 35.5H32" />
      </g>
    </Frame>
  );
}

/** Tilted instant photo of sun-over-wave, verified. */
export function PhotoProofArt({ className }: { className?: string }) {
  return (
    <Frame className={className} title="Photo proof">
      <g {...STROKE} transform="rotate(-5 24 24)">
        <rect x="11" y="9" width="26" height="30" rx="2.5" />
        <rect x="14.5" y="12.5" width="19" height="18" rx="1.5" />
        {/* sun over a wave — the clean, in coastal shorthand */}
        <circle cx="21.5" cy="19" r="3" stroke={CORAL} />
        <path d="M16 27c2-2.2 4-2.2 6 0s4 2.2 6 0" stroke={BRAND} />
      </g>
      {/* verified badge */}
      <circle cx="36" cy="35" r="6" fill={BRAND} />
      <path d="M33.5 35l1.8 1.8 3.2-3.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** A stack of folded linens with the brand wave on the front fold. */
export function LinensArt({ className }: { className?: string }) {
  return (
    <Frame className={className} title="Inventory">
      <g {...STROKE}>
        <path d="M10 31h28v4a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3v-4z" />
        <path d="M11.5 24H36.5a2 2 0 0 1 2 2v5h-29v-5a2 2 0 0 1 2-2z" />
        <path d="M14 17h20a2.5 2.5 0 0 1 2.5 2.5V24h-25v-4.5A2.5 2.5 0 0 1 14 17z" />
        <path d="M20 27.5c1.4-1.5 2.8-1.5 4.2 0s2.8 1.5 4.2 0" stroke={BRAND} />
      </g>
      {/* low-stock spark */}
      <path d="M37 10.5l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4z" fill={CORAL} />
    </Frame>
  );
}

/** Wallet with a paid coin — who's owed what, per clean. */
export function PaymentsArt({ className }: { className?: string }) {
  return (
    <Frame className={className} title="Payment tracking">
      <g {...STROKE}>
        <rect x="9" y="14" width="30" height="23" rx="4" />
        <path d="M13 14v-1.5a3 3 0 0 1 3-3h16" />
        <path d="M31 23h8v7h-8a3.5 3.5 0 0 1 0-7z" />
      </g>
      <circle cx="33.5" cy="26.5" r="1.8" fill={BRAND} />
      <g {...STROKE}>
        <circle cx="18" cy="25.5" r="5" stroke={BRAND} />
        <path d="M18 23v5M16.5 24.2h2.4a1.2 1.2 0 0 1 0 2.4h-1.8a1.2 1.2 0 0 0 0 2.4h2.4" stroke={BRAND} strokeWidth="1.6" />
      </g>
    </Frame>
  );
}
