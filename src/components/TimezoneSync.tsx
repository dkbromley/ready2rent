'use client';

import { useEffect } from 'react';
import { saveUserTimezone } from '@/server/actions';

/**
 * Detects the browser's IANA timezone on mount and saves it if it differs from
 * what the server has stored. Renders nothing. One-shot per load; the write is
 * skipped when the stored zone already matches, so this is almost always a
 * no-op after the first visit.
 */
export function TimezoneSync({ current }: { current: string | null | undefined }) {
  useEffect(() => {
    let detected: string | undefined;
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (detected && detected !== current) {
      void saveUserTimezone(detected);
    }
  }, [current]);

  return null;
}
