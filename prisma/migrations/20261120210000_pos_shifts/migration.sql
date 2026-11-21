CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openingCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingCash" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Sale" ADD COLUMN "shiftId" TEXT;
CREATE INDEX "Shift_shopId_openedAt_idx" ON "Shift"("shopId", "openedAt");
CREATE INDEX "Shift_cashierId_status_idx" ON "Shift"("cashierId", "status");
CREATE UNIQUE INDEX "Shift_one_open_per_cashier" ON "Shift"("shopId", "cashierId") WHERE "status" = 'OPEN';
CREATE INDEX "Sale_shiftId_idx" ON "Sale"("shiftId");
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
