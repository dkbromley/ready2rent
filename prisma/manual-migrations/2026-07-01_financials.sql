-- Financials: manual cleaning-payment tracking + per-property expenses.
-- Additive only. Amounts are whole dollars (INTEGER).

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('APPLE_PAY', 'VENMO', 'CASH_APP', 'ZELLE', 'CASH', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('DUE', 'PAID', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM ('SUPPLIES', 'REPAIRS', 'UTILITIES', 'CLEANING', 'FEES', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Payment" (
  "id"              TEXT NOT NULL,
  "propertyId"      TEXT NOT NULL,
  "jobId"           TEXT,
  "amount"          INTEGER NOT NULL,
  "method"          "PaymentMethod",
  "status"          "PaymentStatus" NOT NULL DEFAULT 'DUE',
  "dueDate"         TIMESTAMP(3),
  "paidAt"          TIMESTAMP(3),
  "reference"       TEXT,
  "note"            TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_jobId_key" ON "Payment" ("jobId");
CREATE INDEX IF NOT EXISTS "Payment_propertyId_status_idx" ON "Payment" ("propertyId", "status");
CREATE INDEX IF NOT EXISTS "Payment_status_dueDate_idx" ON "Payment" ("status", "dueDate");
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "TurnoverJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Expense" (
  "id"              TEXT NOT NULL,
  "propertyId"      TEXT NOT NULL,
  "amount"          INTEGER NOT NULL,
  "category"        "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
  "description"     TEXT NOT NULL,
  "vendor"          TEXT,
  "incurredAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receiptUrl"      TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Expense_propertyId_incurredAt_idx" ON "Expense" ("propertyId", "incurredAt");
DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Match the RLS posture of the rest of the schema (Prisma bypasses RLS as owner).
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
