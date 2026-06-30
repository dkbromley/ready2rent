-- Per-property inventory: cleaning supplies + linens by size. Additive only.
DO $$ BEGIN
  CREATE TYPE "InventoryCategory" AS ENUM ('SUPPLY', 'LINEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id"         TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "category"   "InventoryCategory" NOT NULL DEFAULT 'SUPPLY',
  "name"       TEXT NOT NULL,
  "size"       TEXT,
  "unit"       TEXT,
  "quantity"   INTEGER NOT NULL DEFAULT 0,
  "parLevel"   INTEGER,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InventoryItem_propertyId_category_idx"
  ON "InventoryItem" ("propertyId", "category");
DO $$ BEGIN
  ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
