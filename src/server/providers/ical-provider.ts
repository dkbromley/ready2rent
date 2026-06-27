import ical from 'node-ical';
import { resolveLocalDateTime } from '@/lib/datetime';
import type {
  ChangeResult,
  FetchResult,
  NormalizedReservation,
  ProviderFeedContext,
  ProviderPropertyContext,
  ReservationProvider,
} from './types';
import type { CalendarPlatform } from '@prisma/client';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FEED_BYTES = 5 * 1024 * 1024; // 5MB guard against hostile/huge feeds

/**
 * ICalReservationProvider — ingests public iCal/ICS feeds.
 *
 * Airbnb and Vrbo expose per-listing .ics export URLs. Their VEVENTs are all-day
 * DATE values: a reservation spanning checkout day D2 after check-in D1 appears
 * as DTSTART=D1, DTEND=D2 (DTEND is exclusive — the checkout day). We resolve the
 * all-day boundaries to absolute instants using the property's default
 * check-in/checkout wall-clock times + timezone.
 *
 * We intentionally do NOT scrape listing pages or accept credentials. iCal only.
 */
export class ICalReservationProvider implements ReservationProvider {
  readonly platform: CalendarPlatform | 'multi' = 'multi';

  async fetchReservations(
    property: ProviderPropertyContext,
    feed: ProviderFeedContext,
  ): Promise<FetchResult> {
    const raw = await this.fetchText(feed.url);
    const parsed = ical.sync.parseICS(raw);

    const reservations: NormalizedReservation[] = [];
    for (const key of Object.keys(parsed)) {
      const event = parsed[key];
      if (!event || event.type !== 'VEVENT') continue;
      const normalized = this.normalizeReservation(event, property, feed);
      if (normalized) reservations.push(normalized);
    }
    return { reservations };
  }

  /**
   * Normalize a single VEVENT into a canonical reservation.
   * - DTEND in iCal is exclusive, and for all-day events points at the checkout
   *   calendar day, which is exactly when the turnover happens.
   */
  normalizeReservation(
    event: ical.VEvent,
    property: ProviderPropertyContext,
    feed: ProviderFeedContext,
  ): NormalizedReservation | null {
    const start = event.start as Date | undefined;
    const end = event.end as Date | undefined;
    if (!start || !end) return null;

    // Skip Airbnb "Not available" / blocked placeholders that carry no booking.
    const summary = (event.summary ?? '').toString();
    const isBlocked = /not available|unavailable|blocked/i.test(summary);
    if (isBlocked) return null;

    const checkInDate = resolveLocalDateTime(
      start,
      property.defaultCheckInTime,
      property.timezone,
    );
    const checkOutDate = resolveLocalDateTime(
      end,
      property.defaultCheckOutTime,
      property.timezone,
    );

    const uid = (event.uid ?? '').toString().trim();
    if (!uid) return null;

    return {
      externalUid: uid,
      sourcePlatform: feed.platform,
      summary: summary || null,
      checkInDate,
      checkOutDate,
      rawStart: start,
      rawEnd: end,
      rawPayload: {
        uid,
        summary,
        start: start.toISOString(),
        end: end.toISOString(),
        description: event.description ? String(event.description) : undefined,
        location: event.location ? String(event.location) : undefined,
      },
    };
  }

  detectChanges(
    existing: Pick<NormalizedReservation, 'checkInDate' | 'checkOutDate' | 'summary'>,
    incoming: NormalizedReservation,
  ): ChangeResult {
    const changedFields: string[] = [];
    if (existing.checkInDate.getTime() !== incoming.checkInDate.getTime()) {
      changedFields.push('checkInDate');
    }
    if (existing.checkOutDate.getTime() !== incoming.checkOutDate.getTime()) {
      changedFields.push('checkOutDate');
    }
    if ((existing.summary ?? '') !== (incoming.summary ?? '')) {
      changedFields.push('summary');
    }
    return { changed: changedFields.length > 0, changedFields };
  }

  private async fetchText(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { Accept: 'text/calendar, text/plain, */*' },
        // Never cache feeds — we always want the live calendar.
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Feed responded ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      if (text.length > MAX_FEED_BYTES) {
        throw new Error('Feed exceeds maximum allowed size.');
      }
      if (!text.includes('BEGIN:VCALENDAR')) {
        throw new Error('Response is not a valid iCalendar feed.');
      }
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const icalProvider = new ICalReservationProvider();
