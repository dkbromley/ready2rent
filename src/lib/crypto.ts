import crypto from 'node:crypto';

/**
 * AES-256-GCM encryption for sensitive values at rest — calendar feed URLs
 * (which can leak reservation data) and property access secrets (door/lockbox
 * codes, owner's-closet codes). Format of the stored string:
 * `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 *
 * FEED_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with:
 *   openssl rand -hex 32
 */
const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.FEED_ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error(
      'FEED_ENCRYPTION_KEY must be set to 64 hex characters (32 bytes). Generate with `openssl rand -hex 32`.',
    );
  }
  return Buffer.from(raw, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Malformed encrypted payload.');
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Encrypt an optional user-entered secret for storage. Trims, treats empty as
 * null (so cleared fields persist as null, not ""), and encrypts non-empty
 * values. Use for fields that are never looked up by value (door codes,
 * closet codes) — no searchable hash is kept.
 */
export function encryptOptional(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  return encryptSecret(v);
}

/**
 * Decrypt a value produced by encryptOptional. Defensive: if the stored value
 * isn't a well-formed ciphertext (e.g. legacy plaintext written before this
 * field was encrypted), the original string is returned rather than throwing,
 * so a display page never crashes on unexpected data.
 */
export function decryptOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return value;
  }
}

/** Stable hash of a feed URL for dedupe/lookup without decrypting. */
export function hashFeedUrl(url: string): string {
  return crypto.createHash('sha256').update(normalizeFeedUrl(url)).digest('hex');
}

/** Lowercase host + trimmed path; preserves query (Airbnb/Vrbo tokens live there). */
export function normalizeFeedUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return url.trim();
  }
}

/** Redact a URL down to host for safe logging (never store full URL in logs). */
export function redactUrlForLog(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '<invalid-url>';
  }
}
