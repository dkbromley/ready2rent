'use client';

import { useEffect, useState } from 'react';

/**
 * The hero's date eyebrow + time-of-day greeting, rendered from the browser's
 * clock so they always match the viewer's actual local date/time — not the
 * server's (which runs in UTC and would roll to "tomorrow" every evening).
 *
 * Server-rendered fallbacks (computed in the user's saved timezone) show for
 * the first paint / no-JS, then the client refines to the exact device zone.
 */
export function DashboardGreeting({
  name,
  fallbackDate,
  fallbackGreeting,
}: {
  name: string | null | undefined;
  fallbackDate: string;
  fallbackGreeting: string;
}) {
  const [now, setNow] = useState<Date | null>(null);

  // Re-derive on mount and at the next minute boundary so a session left open
  // across midnight doesn't show yesterday.
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now
    ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : fallbackDate;

  const greeting = now ? greetingForHour(now.getHours()) : fallbackGreeting;
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-brand-200" suppressHydrationWarning>
        {dateLabel}
      </p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl" suppressHydrationWarning>
        {greeting}
        {firstName ? `, ${firstName}` : ''}
      </h1>
    </>
  );
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Up early';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
