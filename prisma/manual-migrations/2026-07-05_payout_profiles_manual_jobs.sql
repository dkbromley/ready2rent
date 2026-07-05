-- Payout profiles, two-sided payment receipts, and manual (one-off) jobs.
-- Additive + one NOT NULL relaxation. Idempotent; safe to re-run.
--
-- 1. User payout profile: how a cleaner prefers to be paid (Ready2Rent never
--    moves the money — these power the "Pay via …" buttons on payment rows).
-- 2. Payment.confirmedAt: the payee's "money arrived" confirmation.
-- 3. Manual jobs: TurnoverJob.reservationId becomes nullable, gains a per-job
--    price, and JobType gains ONE_OFF / MOVE_OUT / DEEP_CLEAN.

-- New JobType values. ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- block on older Postgres; run these statements individually if needed.
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'ONE_OFF';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'MOVE_OUT';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'DEEP_CLEAN';

-- User payout profile.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "payoutMethod" "PaymentMethod";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "payoutHandle" TEXT;

-- Payee confirmation on payments.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

-- Manual jobs: reservation becomes optional, per-job price override.
ALTER TABLE "TurnoverJob" ALTER COLUMN "reservationId" DROP NOT NULL;
ALTER TABLE "TurnoverJob" ADD COLUMN IF NOT EXISTS "price" INTEGER;
