import { cn } from '@/lib/utils';

/** Building blocks for instant route loading states (loading.tsx). */

export function Bar({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/** Thin indeterminate progress bar shown at the top of every loading screen. */
export function LoadingBar() {
  return <div className="loading-bar mb-6" aria-label="Loading" role="progressbar" />;
}

function HeaderSkeleton() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="space-y-2">
        <Bar className="h-6 w-40" />
        <Bar className="h-3 w-56" />
      </div>
      <Bar className="h-9 w-32 rounded-xl" />
    </div>
  );
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-3 p-4">
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} className={cn('h-3', i === 0 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Dashboard / list shape: stat tiles + content cards. The default fallback. */
export function PageSkeleton({ tiles = 4, cards = 4 }: { tiles?: number; cards?: number }) {
  return (
    <div>
      <LoadingBar />
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="card space-y-3 p-4">
            <Bar className="h-8 w-8 rounded-xl" />
            <Bar className="h-3 w-16" />
            <Bar className="h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Detail shape: hero + summary band + body. */
export function DetailSkeleton() {
  return (
    <div>
      <LoadingBar />
      <Bar className="mb-4 h-3 w-24" />
      <Bar className="mb-6 h-7 w-52" />
      <Bar className="mb-6 h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-2 p-4">
            <Bar className="h-3 w-16" />
            <Bar className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}
