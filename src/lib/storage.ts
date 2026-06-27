import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * Job photo storage.
 *
 * Production: Supabase Storage (public bucket) via the service-role key — uploads
 * are authorized at our API layer (canAccessJob), so service-role behind that
 * boundary is the right call. Returns a public URL.
 *
 * Dev fallback: if Supabase Storage isn't configured, write to /public/uploads so
 * local development works without any cloud setup.
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

export interface StoredPhoto {
  url: string;
  storage: 'supabase' | 'local';
}

export async function storeJobPhoto(
  jobId: string,
  bytes: Buffer,
  ext: string,
  contentType: string,
): Promise<StoredPhoto> {
  const safeExt = (ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const filename = `${jobId}-${randomUUID()}.${safeExt}`;

  if (isSupabaseStorageConfigured()) {
    const client = adminClient();
    const objectPath = `${jobId}/${filename}`;
    const { error } = await client.storage
      .from(BUCKET)
      .upload(objectPath, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const { data } = client.storage.from(BUCKET).getPublicUrl(objectPath);
    return { url: data.publicUrl, storage: 'supabase' };
  }

  // Dev local fallback.
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);
  return { url: `/uploads/${filename}`, storage: 'local' };
}
