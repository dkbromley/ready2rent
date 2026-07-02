import { cn } from '@/lib/utils';

/**
 * Section divider that makes the "ocean over sand" brand metaphor literal:
 * a layered swell that eases the dark hero band into the light page.
 *
 * The wave is filled with `currentColor` — set a text color class for the
 * background of the section it flows INTO (e.g. `text-surface`), and place it
 * as the last child of the section it flows OUT of. A faint back swell adds
 * depth without extra markup.
 */
export function WaveDivider({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 72"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('block h-10 w-full sm:h-14 lg:h-[72px]', flip && 'rotate-180', className)}
    >
      {/* back swell */}
      <path
        d="M0 46c120-26 260-30 400-14s260 34 400 30 280-30 420-40c88-6 160-2 220 6v44H0V46z"
        fill="currentColor"
        opacity="0.35"
      />
      {/* front swell */}
      <path
        d="M0 58c140-30 280-36 430-22s300 36 450 30 300-34 420-38c56-2 104 2 140 8v36H0V58z"
        fill="currentColor"
      />
    </svg>
  );
}
