/**
 * Security hardening: enable Row Level Security on every application table.
 *   npm run harden:rls
 *
 * Why: Supabase exposes PostgREST on the public anon key. Our app never uses that
 * path (all access is via Prisma's privileged Postgres connection), so we lock it
 * down: RLS enabled + zero policies = deny-all for the anon/authenticated roles.
 * The table owner (the `postgres` role Prisma connects as) bypasses RLS, so the
 * app is unaffected. Idempotent — safe to re-run after adding new tables.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', r.tablename);
      END LOOP;
    END $$;
  `);

  const rows = await prisma.$queryRawUnsafe<{ tablename: string; rowsecurity: boolean }[]>(`
    SELECT tablename, rowsecurity FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename;
  `);

  console.log('RLS status:');
  for (const r of rows) console.log(`  ${r.rowsecurity ? '🔒' : '⚠️ '} ${r.tablename}`);

  // Confirm Prisma still reads (owner bypasses RLS).
  const users = await prisma.user.count();
  console.log(`Prisma still works (user count = ${users}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
