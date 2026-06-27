/**
 * One-shot data + storage migration between two Supabase projects (region move).
 *   npm run migrate:region
 *
 * Reads from OLD_* and writes to NEW_* — set all six in the environment:
 *   OLD_DATABASE_URL   (old DIRECT url, port 5432)
 *   NEW_DATABASE_URL   (new DIRECT url, port 5432)
 *   OLD_SUPABASE_URL   NEW_SUPABASE_URL          (https://<ref>.supabase.co)
 *   OLD_SERVICE_KEY    NEW_SERVICE_KEY           (service_role keys)
 *
 * Assumes the NEW database schema already exists (run `prisma db push` against
 * NEW first). Copies every table in FK-dependency order, then migrates storage
 * objects referenced by the DB and rewrites their URLs to the new project.
 */
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

const oldDb = new PrismaClient({ datasourceUrl: need('OLD_DATABASE_URL') });
const newDb = new PrismaClient({ datasourceUrl: need('NEW_DATABASE_URL') });
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'job-photos';

const oldStore = createClient(need('OLD_SUPABASE_URL'), need('OLD_SERVICE_KEY'), { auth: { persistSession: false } });
const newStore = createClient(need('NEW_SUPABASE_URL'), need('NEW_SERVICE_KEY'), { auth: { persistSession: false } });

// FK-dependency order.
const MODELS = [
  'user',
  'organization',
  'organizationMember',
  'property',
  'calendarFeed',
  'reservation',
  'turnoverJob',
  'jobStatusHistory',
  'jobPhoto',
  'notification',
  'syncLog',
  'serviceProviderProfile',
  'propertyOwnerContact',
  'messageLog',
] as const;

async function copyData() {
  for (const model of MODELS) {
    const rows = await (oldDb as any)[model].findMany();
    if (rows.length === 0) {
      console.log(`  ${model}: 0`);
      continue;
    }
    await (newDb as any)[model].createMany({ data: rows, skipDuplicates: true });
    console.log(`  ${model}: ${rows.length}`);
  }
}

async function migrateOneObject(url: string): Promise<string | null> {
  const path = url.split(`/${BUCKET}/`)[1]?.split('?')[0];
  if (!path) return null;
  const decoded = decodeURIComponent(path);
  const { data, error } = await oldStore.storage.from(BUCKET).download(decoded);
  if (error || !data) {
    console.log(`    skip (not found): ${decoded}`);
    return null;
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  const up = await newStore.storage.from(BUCKET).upload(decoded, bytes, {
    contentType: data.type || 'image/jpeg',
    upsert: true,
  });
  if (up.error) {
    console.log(`    upload failed: ${decoded} — ${up.error.message}`);
    return null;
  }
  return newStore.storage.from(BUCKET).getPublicUrl(decoded).data.publicUrl;
}

async function migrateStorage() {
  const photos = await newDb.jobPhoto.findMany({ select: { id: true, url: true } });
  for (const p of photos) {
    const u = await migrateOneObject(p.url);
    if (u) await newDb.jobPhoto.update({ where: { id: p.id }, data: { url: u } });
  }
  console.log(`  job photos: ${photos.length}`);

  const props = await newDb.property.findMany({ where: { imageUrl: { not: null } }, select: { id: true, imageUrl: true } });
  for (const pr of props) {
    const u = await migrateOneObject(pr.imageUrl!);
    if (u) await newDb.property.update({ where: { id: pr.id }, data: { imageUrl: u } });
  }
  console.log(`  property images: ${props.length}`);
}

async function main() {
  console.log('Copying data old → new…');
  await copyData();
  console.log('Migrating storage objects…');
  await migrateStorage();
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await oldDb.$disconnect();
    await newDb.$disconnect();
  });
