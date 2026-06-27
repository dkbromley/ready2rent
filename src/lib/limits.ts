/** Shared upload limits (job photos + property images). */
export const MAX_PHOTOS_PER_JOB = 8;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

/** Days a completed job stays visible (Archive) before cleanup. */
export const ARCHIVE_AFTER_DAYS = 30;
