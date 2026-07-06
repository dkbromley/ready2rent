import { randomUUID } from 'node:crypto';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * Object storage for job photos, property images, and receipts.
 *
 * Two buckets:
 *  - PUBLIC (`job-photos`): job photos + property images. These are shown to
 *    hosts, cleaners, and the owner-claim funnel via stable public URLs.
 *  - PRIVATE (`receipts`): expense receipts are financial documents, so they
 *    live in a private bucket. We store only the object *path* in the DB and
 *    mint a short-lived signed URL at view time, after the caller has passed
 *    the property authorization check — a leaked URL expires within the hour.
 *
 * Uploads are authorized at the API layer, so service-role behind that
 * boundary is correct. Dev fallback writes to /public/uploads so local
 * development needs no cloud setup.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'job-photos';
export const RECEIPTS_BUCKET = process.env.SUPABASE_RECEIPTS_BUCKET || 'receipts';
/** How long a minted receipt signed URL stays valid. */
const RECEIPT_URL_TTL_SECONDS = 60 * 60;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

function adminClient() {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface StoredFile {
  url: string;
  storage: 'supabase' | 'local';
}

function safeExt(ext: string): string {
  return (ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}

/** Store in the PUBLIC bucket; returns a stable public URL. */
async function storePublic(prefix: string, bytes: Buffer, ext: string, contentType: string): Promise<StoredFile> {
  const filename = `${randomUUID()}.${safeExt(ext)}`;

  if (isSupabaseStorageConfigured()) {
    const objectPath = `${prefix}/${filename}`;
    const { error } = await adminClient()
      .storage.from(BUCKET)
      .upload(objectPath, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const { data } = adminClient().storage.from(BUCKET).getPublicUrl(objectPath);
    return { url: data.publicUrl, storage: 'supabase' };
  }

  return storeLocal(prefix, filename, bytes);
}

/**
 * Store in the PRIVATE receipts bucket; returns the object *path* (not a URL).
 * Persist that path; resolve it to a viewable link with `receiptViewUrl` only
 * after an authorization check. Dev fallback stores under /public/uploads.
 */
async function storePrivate(prefix: string, bytes: Buffer, ext: string, contentType: string): Promise<StoredFile> {
  const filename = `${randomUUID()}.${safeExt(ext)}`;

  if (isSupabaseStorageConfigured()) {
    const objectPath = `${prefix}/${filename}`;
    const { error } = await adminClient()
      .storage.from(RECEIPTS_BUCKET)
      .upload(objectPath, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return { url: objectPath, storage: 'supabase' };
  }

  return storeLocal(prefix, filename, bytes);
}

async function storeLocal(prefix: string, filename: string, bytes: Buffer): Promise<StoredFile> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  const flat = `${prefix.replace(/\//g, '-')}-${filename}`;
  await writeFile(path.join(uploadDir, flat), bytes);
  return { url: `/uploads/${flat}`, storage: 'local' };
}

export function storeJobPhoto(jobId: string, bytes: Buffer, ext: string, contentType: string) {
  return storePublic(`jobs/${jobId}`, bytes, ext, contentType);
}

export function storePropertyImage(propertyId: string, bytes: Buffer, ext: string, contentType: string) {
  return storePublic(`property-images/${propertyId}`, bytes, ext, contentType);
}

export function storeReceipt(propertyId: string, bytes: Buffer, ext: string, contentType: string) {
  return storePrivate(`receipts/${propertyId}`, bytes, ext, contentType);
}

/**
 * Resolve a stored receipt reference to a viewable URL. For private-bucket
 * object paths this mints a short-lived signed URL; dev `/uploads/…` paths and
 * any legacy absolute URLs are returned as-is. Call ONLY after authorizing the
 * viewer against the receipt's property. Returns null if signing fails.
 */
export async function receiptViewUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  // Dev-local file or a legacy public URL — nothing to sign.
  if (stored.startsWith('/uploads/') || /^https?:\/\//i.test(stored)) return stored;
  if (!isSupabaseStorageConfigured()) return stored;
  const { data, error } = await adminClient()
    .storage.from(RECEIPTS_BUCKET)
    .createSignedUrl(stored, RECEIPT_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Delete a receipt by its stored reference (private object path or dev URL). */
export async function deleteReceipt(stored: string | null | undefined): Promise<void> {
  if (!stored) return;
  try {
    if (stored.startsWith('/uploads/')) {
      await unlink(path.join(process.cwd(), 'public', stored.replace('/uploads/', 'uploads/'))).catch(() => undefined);
      return;
    }
    if (/^https?:\/\//i.test(stored)) {
      // Legacy public-bucket URL (pre-hardening); route through the URL deleter.
      await deleteStoredFile(stored);
      return;
    }
    if (isSupabaseStorageConfigured()) {
      await adminClient().storage.from(RECEIPTS_BUCKET).remove([stored]);
    }
  } catch {
    // Non-fatal: storage cleanup failures shouldn't block the request.
  }
}

/** Best-effort delete of a previously stored file, given its public URL. */
export async function deleteStoredFile(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (isSupabaseStorageConfigured() && url.includes(`/${BUCKET}/`)) {
      const objectPath = url.split(`/${BUCKET}/`)[1]?.split('?')[0];
      if (objectPath) await adminClient().storage.from(BUCKET).remove([decodeURIComponent(objectPath)]);
      return;
    }
    if (url.startsWith('/uploads/')) {
      await unlink(path.join(process.cwd(), 'public', url.replace('/uploads/', 'uploads/'))).catch(() => undefined);
    }
  } catch {
    // Non-fatal: storage cleanup failures shouldn't block the request.
  }
}

/** Bulk delete by public URL (used by the archive cleanup cron). */
export async function deleteStoredFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  if (isSupabaseStorageConfigured()) {
    const paths = urls
      .filter((u) => u.includes(`/${BUCKET}/`))
      .map((u) => decodeURIComponent(u.split(`/${BUCKET}/`)[1]?.split('?')[0] ?? ''))
      .filter(Boolean);
    if (paths.length) await adminClient().storage.from(BUCKET).remove(paths).then(() => undefined, () => undefined);
  }
  await Promise.all(urls.filter((u) => u.startsWith('/uploads/')).map((u) => deleteStoredFile(u)));
}
