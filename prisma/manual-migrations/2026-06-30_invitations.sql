-- Host <-> cleaner invitations. Additive only.
DO $$ BEGIN
  CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Invitation" (
  "id"               TEXT NOT NULL,
  "token"            TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "invitedRole"      "UserRole" NOT NULL,
  "status"           "InviteStatus" NOT NULL DEFAULT 'PENDING',
  "invitedByUserId"  TEXT NOT NULL,
  "organizationId"   TEXT,
  "propertyId"       TEXT,
  "acceptedByUserId" TEXT,
  "acceptedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"        TIMESTAMP(3),
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation" ("token");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation" ("email");
CREATE INDEX IF NOT EXISTS "Invitation_status_idx" ON "Invitation" ("status");
CREATE INDEX IF NOT EXISTS "Invitation_propertyId_idx" ON "Invitation" ("propertyId");

DO $$ BEGIN
  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedByUserId_fkey"
    FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
