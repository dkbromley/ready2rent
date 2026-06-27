import { CalendarPlatform } from '@prisma/client';
import { icalProvider } from './ical-provider';
import type { ReservationProvider } from './types';

/**
 * Provider registry. Phase 1: every platform resolves to the iCal provider
 * (Airbnb/Vrbo/Manual/Other all expose .ics feeds). Future direct-API providers
 * register here keyed by platform without touching callers.
 *
 *   registry[CalendarPlatform.AIRBNB] = new AirbnbApiReservationProvider();
 */
const registry: Partial<Record<CalendarPlatform, ReservationProvider>> = {
  [CalendarPlatform.AIRBNB]: icalProvider,
  [CalendarPlatform.VRBO]: icalProvider,
  [CalendarPlatform.MANUAL]: icalProvider,
  [CalendarPlatform.OTHER]: icalProvider,
};

export function getProvider(platform: CalendarPlatform): ReservationProvider {
  return registry[platform] ?? icalProvider;
}

export type { ReservationProvider } from './types';
