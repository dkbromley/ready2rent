import { CalendarPlatform } from '@prisma/client';

/**
 * Best-effort platform detection from an iCal export URL, so cleaners don't have
 * to know/choose the source — paste the link and we label it.
 */
export function detectPlatformFromUrl(url: string): CalendarPlatform {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return CalendarPlatform.OTHER;
  }
  if (host.includes('airbnb')) return CalendarPlatform.AIRBNB;
  if (host.includes('vrbo') || host.includes('homeaway') || host.includes('expediagroup')) {
    return CalendarPlatform.VRBO;
  }
  return CalendarPlatform.OTHER;
}
