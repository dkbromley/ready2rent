'use client';

import { useEffect, useState } from 'react';
import { toZonedTime } from 'date-fns-tz';

/**
 * Live "now" line for the today timeline. Client-only (renders nothing until
 * mounted) so the server HTML never disagrees with the visitor's clock.
 * Positions itself in the given IANA timezone — the same one the bars are
 * drawn in — so a host traveling out of market still sees the line where
 * their properties' day actually is. Refreshes each minute.
 */
export function NowMarker({
  startHour,
  endHour,
  timezone,
}: {
  startHour: number;
  endHour: number;
  timezone: string;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      let d: Date;
      try {
        d = toZonedTime(new Date(), timezone);
      } catch {
        d = new Date();
      }
      setMinutes(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [timezone]);

  if (minutes == null || minutes < startHour * 60 || minutes > endHour * 60) return null;
  const left = ((minutes - startHour * 60) / ((endHour - startHour) * 60)) * 100;

  return (
    <span className="absolute inset-y-0 z-10" style={{ left: `${left}%` }} aria-hidden="true">
      <span className="absolute inset-y-0 w-px bg-coral-500/80" />
      <span className="absolute -left-[3px] -top-0.5 h-2 w-2 rounded-full bg-coral-500 shadow-[0_0_8px_1px_rgba(207,84,48,0.6)]" />
    </span>
  );
}
