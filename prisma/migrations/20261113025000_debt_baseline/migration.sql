-- Older installations created Debt through db push. Fresh databases need it before offline deduplication.
CREATE TABLE IF NOT EXISTS "Debt" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Debt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Debt_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Debt_shopId_idx" ON "Debt"("shopId");
CREATE INDEX IF NOT EXISTS "Debt_status_idx" ON "Debt"("status");
