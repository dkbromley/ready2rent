-- Email channel opt-in for urgent teammate alerts (same-day turnovers,
-- problems, direct assignment). Opt-in, unlike the category flags.
-- Additive only. Idempotent; safe to re-run.

ALTER TABLE "NotificationPreference"
  ADD COLUMN IF NOT EXISTS "emailAlerts" BOOLEAN NOT NULL DEFAULT false;
