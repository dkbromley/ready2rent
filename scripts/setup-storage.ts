/**
 * Creates the Supabase Storage buckets (idempotent):
 *   - PUBLIC  "job-photos": job photos + property images (stable public URLs).
 *   - PRIVATE "receipts":   expense receipts, served only via signed URLs.
 *   npm run setup:storage
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicBucket = process.env.SUPABASE_STORAGE_BUCKET || 'job-photos';
const receiptsBucket = process.env.SUPABASE_RECEIPTS_BUCKET || 'receipts';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

async function main() {
  if (!url || !serviceKey) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.');
  }
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: buckets, error: listErr } = await client.storage.listBuckets();
  if (listErr) throw listErr;
  const existing = new Set((buckets ?? []).map((b) => b.name));

  const wanted = [
    {
      name: publicBucket,
      options: { public: true, fileSizeLimit: '8MB', allowedMimeTypes: IMAGE_TYPES },
      label: 'public',
    },
    {
      // Receipts are financial documents — private, served via signed URLs.
      name: receiptsBucket,
      options: { public: false, fileSizeLimit: '8MB', allowedMimeTypes: [...IMAGE_TYPES, 'application/pdf'] },
      label: 'private',
    },
  ];

  for (const b of wanted) {
    if (existing.has(b.name)) {
      console.log(`Bucket "${b.name}" already exists.`);
      continue;
    }
    const { error } = await client.storage.createBucket(b.name, b.options);
    if (error) throw error;
    console.log(`Created ${b.label} bucket "${b.name}".`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
