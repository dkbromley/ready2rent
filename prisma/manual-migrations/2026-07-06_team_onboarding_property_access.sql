-- Team new-hire onboarding checklists + property access details.
-- Additive only. Idempotent; safe to re-run.
--
-- 1. TeamOnboardingItem / TeamOnboardingCheck: a cleaning company's new-hire
--    checklist template + per-member completion (mirrors the property
--    checklist pattern).
-- 2. Property access fields: unit number, main door access (lockbox/door
--    code or key location), owner's closet access.

-- Property access details.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "unitNumber" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "mainDoorAccess" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ownerClosetAccess" TEXT;

-- New-hire onboarding checklist template (per cleaning company).
CREATE TABLE IF NOT EXISTS "TeamOnboardingItem" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "text"           TEXT NOT NULL,
  "position"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamOnboardingItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TeamOnboardingItem_organizationId_position_idx"
  ON "TeamOnboardingItem" ("organizationId", "position");
DO $$ BEGIN
  ALTER TABLE "TeamOnboardingItem" ADD CONSTRAINT "TeamOnboardingItem_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Per-member completion of an onboarding item.
CREATE TABLE IF NOT EXISTS "TeamOnboardingCheck" (
  "id"              TEXT NOT NULL,
  "itemId"          TEXT NOT NULL,
  "memberId"        TEXT NOT NULL,
  "checkedByUserId" TEXT,
  "checkedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamOnboardingCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeamOnboardingCheck_itemId_memberId_key"
  ON "TeamOnboardingCheck" ("itemId", "memberId");
CREATE INDEX IF NOT EXISTS "TeamOnboardingCheck_memberId_idx"
  ON "TeamOnboardingCheck" ("memberId");
DO $$ BEGIN
  ALTER TABLE "TeamOnboardingCheck" ADD CONSTRAINT "TeamOnboardingCheck_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "TeamOnboardingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamOnboardingCheck" ADD CONSTRAINT "TeamOnboardingCheck_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- RLS to match the rest of the schema (the app connects as table owner and
-- bypasses it; the app layer is the authorization boundary).
ALTER TABLE "TeamOnboardingItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamOnboardingCheck" ENABLE ROW LEVEL SECURITY;
