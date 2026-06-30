-- Notification preferences: distinct JOB_PROBLEM type + per-user opt-out table.
-- Additive only.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_PROBLEM';

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "newJobs"         BOOLEAN NOT NULL DEFAULT true,
  "jobChanges"      BOOLEAN NOT NULL DEFAULT true,
  "jobCompleted"    BOOLEAN NOT NULL DEFAULT true,
  "jobCanceled"     BOOLEAN NOT NULL DEFAULT true,
  "sameDayTurnover" BOOLEAN NOT NULL DEFAULT true,
  "problems"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key"
  ON "NotificationPreference" ("userId");
DO $$ BEGIN
  ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
