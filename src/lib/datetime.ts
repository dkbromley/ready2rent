import { fromZonedTime, toZonedTime, format as formatTz } from 'date-fns-tz';

/**
 * Timezone-aware helpers for resolving turnover timing.
 *
 * iCal feeds from Airbnb/Vrbo deliver checkout/checkin as DATE values (all-day,
 * no time component). We resolve those into absolute instants using the
 * property's configured wall-clock default times + IANA timezone, so the
 * turnover window is computed correctly regardless of where the server runs.
 */

/** Parse "HH:mm" -> [hours, minutes]. Falls back to [0,0] on bad input. */
export function parseTimeOfDay(value: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? '');
  if (!m) return [0, 0];
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return [h, min];
}

/** Format a wall-clock "HH:mm" string as 12-hour with meridiem, e.g. "4:00 PM". */
export function formatTimeOfDay12(value: string): string {
  const [h, min] = parseTimeOfDay(value);
  const meridiem = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${meridiem}`;
}

/**
 * Given a date (any instant on the target calendar day) and a wall-clock time
 * in a timezone, return the absolute UTC instant for that local wall time.
 *
 * Pass isAllDay=true for iCal VALUE=DATE events: node-ical encodes those as UTC
 * midnight, so we must read the date components from UTC directly — calling
 * toZonedTime() would shift the date backward for any timezone behind UTC.
 */
export function resolveLocalDateTime(
  day: Date,
  timeOfDay: string,
  timezone: string,
  isAllDay = false,
): Date {
  const [h, min] = parseTimeOfDay(timeOfDay);
  let y: number, mo: string, d: string;
  if (isAllDay) {
    // node-ical stores VALUE=DATE as UTC midnight; read components from UTC.
    y = day.getUTCFullYear();
    mo = String(day.getUTCMonth() + 1).padStart(2, '0');
    d = String(day.getUTCDate()).padStart(2, '0');
  } else {
    // Work out the calendar Y/M/D *in the property's timezone*.
    const zoned = toZonedTime(day, timezone);
    y = zoned.getFullYear();
    mo = String(zoned.getMonth() + 1).padStart(2, '0');
    d = String(zoned.getDate()).padStart(2, '0');
  }
  const hh = String(h).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  // Interpret "YYYY-MM-DDTHH:mm:ss" as wall time in `timezone`, get UTC instant.
  return fromZonedTime(`${y}-${mo}-${d}T${hh}:${mm}:00`, timezone);
}

/** Returns the YYYY-MM-DD local-day key for an instant in a timezone. */
export function localDayKey(instant: Date, timezone: string): string {
  return formatTz(toZonedTime(instant, timezone), 'yyyy-MM-dd', { timeZone: timezone });
}

/** True when two instants fall on the same calendar day in the given timezone. */
export function isSameLocalDay(a: Date, b: Date, timezone: string): boolean {
  return localDayKey(a, timezone) === localDayKey(b, timezone);
}

/**
 * UTC instant for the start (local midnight) of the calendar day that is
 * `offsetDays` from today, in `timezone`. offset 0 = today, 1 = tomorrow,
 * -6 = six days ago. Used to bucket dashboards by the user's local day rather
 * than the server's. Whole-day offsets read through the day key, so a DST
 * transition never lands the boundary on the wrong date.
 */
export function startOfLocalDay(timezone: string, offsetDays = 0, ref: Date = new Date()): Date {
  const shifted = new Date(ref.getTime() + offsetDays * 86_400_000);
  const key = localDayKey(shifted, timezone);
  return fromZonedTime(`${key}T00:00:00.000`, timezone);
}

/** True if `tz` is a valid IANA timezone name (defends the detect→save path). */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Whole minutes between two instants (b - a). Negative if b precedes a. */
export function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function formatInTz(instant: Date, timezone: string, fmt = 'EEE MMM d, h:mm a'): string {
  return formatTz(toZonedTime(instant, timezone), fmt, { timeZone: timezone });
}
