import { randomUUID } from 'node:crypto';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * Object storage for job photos and property images.
 *
 * Production: a single public Supabase Storage bucket, keyed by path prefix
 * (`jobs/<id>/…`, `property-images/<id>/…`). Uploads are authorized at the API
 * layer, so service-role behind that boundary is correct. Dev fallback writes to
 * /public/uploads so local development needs no cloud setup.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'job-photos';

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

async function store(prefix: string, bytes: Buffer, ext: string, contentType: string): Promise<StoredFile> {
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

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  const flat = `${prefix.replace(/\//g, '-')}-${filename}`;
  await writeFile(path.join(uploadDir, flat), bytes);
  return { url: `/uploads/${flat}`, storage: 'local' };
}

export function storeJobPhoto(jobId: string, bytes: Buffer, ext: string, contentType: string) {
  return store(`jobs/${jobId}`, bytes, ext, contentType);
}

export function storePropertyImage(propertyId: string, bytes: Buffer, ext: string, contentType: string) {
  return store(`property-images/${propertyId}`, bytes, ext, contentType);
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
