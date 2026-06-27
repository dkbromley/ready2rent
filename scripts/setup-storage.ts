/**
 * Creates the public Supabase Storage bucket for job photos (idempotent).
 *   npm run setup:storage
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'job-photos';

async function main() {
  if (!url || !serviceKey) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.');
  }
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: buckets, error: listErr } = await client.storage.listBuckets();
  if (listErr) throw listErr;

  if (buckets?.some((b) => b.name === bucket)) {
    console.log(`Bucket "${bucket}" already exists.`);
    return;
  }

  const { error } = await client.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: '8MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  });
  if (error) throw error;
  console.log(`Created public bucket "${bucket}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
