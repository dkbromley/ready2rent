/**
 * Time-of-day greeting shared by the client hero (browser clock) and the
 * server-rendered fallbacks (user's saved timezone). Lives outside any
 * 'use client' module so server components can call it during render.
 */
export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Up early';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
