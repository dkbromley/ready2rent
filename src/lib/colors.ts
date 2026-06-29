/**
 * Property color palette for the calendar. A property may store an explicit
 * `calendarColor` (hex); when it hasn't, we derive a stable color from its id so
 * the same property is always the same color.
 */
export const PROPERTY_PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f97316', // orange
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#d97706', // amber
  '#ef4444', // red
  '#14b8a6', // teal
  '#6366f1', // indigo
] as const;

/** Deterministic fallback color from a property id. */
export function fallbackPropertyColor(propertyId: string): string {
  let hash = 0;
  for (const c of propertyId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return PROPERTY_PALETTE[hash % PROPERTY_PALETTE.length];
}

/** The color a property's bars should use: explicit override or fallback. */
export function resolvePropertyColor(propertyId: string, calendarColor?: string | null): string {
  return calendarColor && /^#[0-9a-fA-F]{6}$/.test(calendarColor)
    ? calendarColor
    : fallbackPropertyColor(propertyId);
}
