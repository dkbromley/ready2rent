-- Manual status lock: when a host/cleaner manually completes or cancels a job,
-- the sync must not auto-reopen or re-date it. Additive, no data rewritten.
ALTER TABLE "TurnoverJob"
  ADD COLUMN IF NOT EXISTS "manualStatusLock" BOOLEAN NOT NULL DEFAULT false;
