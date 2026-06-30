-- Checklists + problem photos + host problem notes.
-- Apply with `npm run db:push` (schema is source of truth) or run this SQL
-- directly against the Supabase Postgres database. Idempotent where practical.

-- 1. Photo kind: distinguish completion photos from problem evidence.
DO $$ BEGIN
  CREATE TYPE "PhotoKind" AS ENUM ('COMPLETION', 'PROBLEM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "JobPhoto"
  ADD COLUMN IF NOT EXISTS "kind" "PhotoKind" NOT NULL DEFAULT 'COMPLETION';
CREATE INDEX IF NOT EXISTS "JobPhoto_jobId_kind_idx" ON "JobPhoto" ("jobId", "kind");

-- 2. Cleaner's problem description, shown to the host with PROBLEM photos.
ALTER TABLE "TurnoverJob"
  ADD COLUMN IF NOT EXISTS "problemNote" TEXT;

-- 3. Host-authored per-property checklist items.
CREATE TABLE IF NOT EXISTS "PropertyChecklistItem" (
  "id"         TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "text"       TEXT NOT NULL,
  "position"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PropertyChecklistItem_propertyId_position_idx"
  ON "PropertyChecklistItem" ("propertyId", "position");
DO $$ BEGIN
  ALTER TABLE "PropertyChecklistItem"
    ADD CONSTRAINT "PropertyChecklistItem_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Per-job checklist completion (row present = item checked for that job).
CREATE TABLE IF NOT EXISTS "JobChecklistCheck" (
  "id"              TEXT NOT NULL,
  "jobId"           TEXT NOT NULL,
  "itemId"          TEXT NOT NULL,
  "checkedByUserId" TEXT,
  "checkedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobChecklistCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobChecklistCheck_jobId_itemId_key"
  ON "JobChecklistCheck" ("jobId", "itemId");
CREATE INDEX IF NOT EXISTS "JobChecklistCheck_jobId_idx" ON "JobChecklistCheck" ("jobId");
DO $$ BEGIN
  ALTER TABLE "JobChecklistCheck"
    ADD CONSTRAINT "JobChecklistCheck_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "TurnoverJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "JobChecklistCheck"
    ADD CONSTRAINT "JobChecklistCheck_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "PropertyChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Match the RLS posture of the rest of the schema (Prisma bypasses RLS as owner).
ALTER TABLE "PropertyChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobChecklistCheck" ENABLE ROW LEVEL SECURITY;
