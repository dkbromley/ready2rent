import ical from 'node-ical';
import { resolveLocalDateTime } from '@/lib/datetime';
import type {
  ChangeResult,
  FetchResult,
  NormalizedReservation,
  ProviderFeedContext,
  ProviderPropertyContext,
  ReservationProvider,
  ReservationSnapshot,
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

    const isAllDay = (event as unknown as Record<string, unknown>).datetype === 'date';
    const checkInDate = resolveLocalDateTime(
      start,
      property.defaultCheckInTime,
      property.timezone,
      isAllDay,
    );
    const checkOutDate = resolveLocalDateTime(
      end,
      property.defaultCheckOutTime,
      property.timezone,
      isAllDay,
    );

    const uid = (event.uid ?? '').toString().trim();
    if (!uid) return null;

    const description = event.description ? String(event.description) : '';
    // Best-effort enrichment from the VEVENT description (Airbnb often includes a
    // reservation-details URL; sometimes the phone last-4). iCal never carries
    // guest name or party size — those stay null until a richer provider fills
    // them. The fields exist on the model so no migration is needed when they do.
    const reservationUrl = this.extractUrl(description);
    const confirmationCode = this.extractConfirmationCode(reservationUrl ?? description);
    const guestPhoneLast4 = this.extractPhoneLast4(description);

    return {
      externalUid: uid,
      sourcePlatform: feed.platform,
      summary: summary || null,
      checkInDate,
      checkOutDate,
      rawStart: start,
      rawEnd: end,
      // iCal events are all-day; times are derived from property defaults.
      hasExactTimes: false,
      guestName: null,
      guestCount: null,
      confirmationCode,
      guestPhoneLast4,
      reservationUrl,
      isCanceled: false,
      rawPayload: {
        uid,
        summary,
        start: start.toISOString(),
        end: end.toISOString(),
        description: description || undefined,
        location: event.location ? String(event.location) : undefined,
      },
    };
  }

  detectChanges(existing: ReservationSnapshot, incoming: NormalizedReservation): ChangeResult {
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
    if ((existing.guestCount ?? null) !== (incoming.guestCount ?? null)) {
      changedFields.push('guestCount');
    }
    if ((existing.confirmationCode ?? '') !== (incoming.confirmationCode ?? '')) {
      changedFields.push('confirmationCode');
    }
    return { changed: changedFields.length > 0, changedFields };
  }

  private extractUrl(text: string): string | null {
    const m = /(https?:\/\/[^\s]+)/i.exec(text);
    return m ? m[1].replace(/[).,]+$/, '') : null;
  }

  /** Airbnb reservation URLs end in the confirmation code, e.g. /details/HMABCDEF. */
  private extractConfirmationCode(text: string): string | null {
    // Prefer the Airbnb-style code (starts with HM, uppercase).
    const hm = /\bHM[A-Z0-9]{6,}\b/.exec(text);
    if (hm) return hm[0];
    // Otherwise take the last path segment of a reservation URL, ignoring the
    // literal path keywords and requiring it to look like a code (has a digit).
    const seg = /\/(?:details|reservations)\/([A-Za-z0-9]{6,})(?:[/?#]|$)/.exec(text);
    if (seg && /\d/.test(seg[1])) return seg[1];
    return null;
  }

  private extractPhoneLast4(text: string): string | null {
    const m = /last\s*4\s*digits?\)?:?\s*(\d{4})/i.exec(text);
    return m ? m[1] : null;
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
