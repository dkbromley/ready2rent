import type { CalendarPlatform } from '@prisma/client';

/**
 * Provider abstraction (Phase 6-ready).
 *
 * A ReservationProvider knows how to pull raw events from a source and normalize
 * them into TurnReady's canonical shape. iCal is the first implementation; direct
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
}

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
  detectChanges(
    existing: Pick<NormalizedReservation, 'checkInDate' | 'checkOutDate' | 'summary'>,
    incoming: NormalizedReservation,
  ): ChangeResult;
}
