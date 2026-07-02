import { cn } from '@/lib/utils';

/**
 * Ready2Rent brand mark: a beach-house roofline over a wave, set in a rounded
 * seafoam-gradient tile. Coastal + rental in one glyph, legible down to favicon
 * size. Pure SVG so it works in server components, emails-as-data-URI, etc.
 */
export function LogoMark({
  className,
  title = 'Ready2Rent',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id="r2r-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#r2r-mark)" />
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {/* roofline */}
        <path d="M9 15 L16 8.5 L23 15" />
        {/* wave */}
        <path d="M8.5 20.5c2.3-2.7 4.9-2.7 7.2 0s4.9 2.7 7.2 0" />
      </g>
    </svg>
  );
}

/** Mark + wordmark lockup. `tone` picks the wordmark color for light or dark
 * backgrounds (the mark itself is always the gradient tile). */
export function Logo({
  className,
  markClassName = 'h-7 w-7',
  tone = 'default',
}: {
  className?: string;
  markClassName?: string;
  tone?: 'default' | 'onDark';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-base font-extrabold tracking-tight',
        tone === 'onDark' ? 'text-white' : 'text-navy-900',
        className,
      )}
    >
      <LogoMark
        className={cn(
          markClassName,
          'shrink-0 rounded-[9px] shadow-[0_4px_12px_-2px_rgba(20,184,166,0.5)]',
        )}
      />
      <span>
        Ready<span className="text-brand-500">2</span>Rent
      </span>
    </span>
  );
}
