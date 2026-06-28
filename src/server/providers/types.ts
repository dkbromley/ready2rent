import type { CalendarPlatform } from '@prisma/client';

/**
 * Provider abstraction (Phase 6-ready).
 *
 * A ReservationProvider knows how to pull raw events from a source and normalize
 * them into Ready2Rent's canonical shape. iCal is the first implementation; direct
 * API providers (Airbnb/Vrbo/Guesty/Hostaway/OwnerRez/Hospitable/Lodgify) add
 * later by implementing this same interface — the sync service and job generator
 * never change.
 */

/** Minimal property context a provider needs to resolve times. */
export interface ProviderPropertyContext {
  id: string;
  timezone: string;
  defaultCheckInTime: string; // "HH:mm"
  defaultCheckOutTime: string; // "HH:mm"
}

/** A feed/connection a provider fetches from. `url` is already decrypted. */
export interface ProviderFeedContext {
  id: string;
  platform: CalendarPlatform;
  url: string;
}

/** Canonical normalized reservation produced by every provider. */
export interface NormalizedReservation {
  /** Stable provider identity (iCal UID, or API reservation id). */
  externalUid: string;
  sourcePlatform: CalendarPlatform;
  summary: string | null;
  /** Resolved absolute instants. */
  checkInDate: Date;
  checkOutDate: Date;
  /** Exactly what the provider delivered, before time resolution. */
  rawStart: Date;
  rawEnd: Date;
  /** Provider-native payload for audit / re-normalization. */
  rawPayload: Record<string, unknown> | null;

  // --- Richer fields (Phase 6 providers). All optional so the model is
  // forward-ready: iCal fills what it can parse; PMS/API providers (Hospitable,
  // Hostaway, Guesty, OwnerRez, Lodgify, Airbnb/Vrbo direct) fill the rest.
  /** Guest's full name (APIs only; iCal does not expose it). */
  guestName?: string | null;
  /** Party size — drives linen quantities in Phase 2 (APIs only). */
  guestCount?: number | null;
  /** Booking confirmation code (e.g. Airbnb HM…); iCal may parse from the URL. */
  confirmationCode?: string | null;
  /** Last 4 digits of guest phone (Airbnb iCal sometimes exposes this). */
  guestPhoneLast4?: string | null;
  /** Deep link to the reservation on the source platform. */
  reservationUrl?: string | null;
  /**
   * True when the provider supplied real check-in/out clock times (APIs); false
   * when we derived them from the property's default times (iCal all-day events).
   */
  hasExactTimes?: boolean;
  /**
   * Explicit cancellation signal. API providers can mark a reservation canceled
   * directly instead of relying on it vanishing from the feed (iCal's only cue).
   */
  isCanceled?: boolean;
}

/** Subset of fields used for change detection across providers. */
export type ReservationSnapshot = Pick<
  NormalizedReservation,
  'checkInDate' | 'checkOutDate' | 'summary' | 'guestCount' | 'confirmationCode'
>;

/** Result of comparing an incoming reservation against the stored one. */
export interface ChangeResult {
  changed: boolean;
  /** Field-level diff for logging / notifications. */
  changedFields: string[];
}

/** What a provider returns from a fetch cycle. */
export interface FetchResult {
  reservations: NormalizedReservation[];
}

export interface ReservationProvider {
  readonly platform: CalendarPlatform | 'multi';

  /** Pull + normalize all current reservations for a feed. May throw on fetch failure. */
  fetchReservations(
    property: ProviderPropertyContext,
    feed: ProviderFeedContext,
  ): Promise<FetchResult>;

  /** Compare a stored reservation snapshot to an incoming one. */
  detectChanges(existing: ReservationSnapshot, incoming: NormalizedReservation): ChangeResult;
}
