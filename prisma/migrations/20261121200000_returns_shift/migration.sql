ALTER TABLE "Return" ADD COLUMN "shiftId" TEXT;

-- Historic returns have no recorded refund shift; retain their original sale shift as a best effort.
UPDATE "Return" AS r SET "shiftId" = s."shiftId"
FROM "Sale" AS s WHERE r."saleId" = s."id" AND s."shiftId" IS NOT NULL;

CREATE INDEX "Return_shiftId_idx" ON "Return"("shiftId");
ALTER TABLE "Return" ADD CONSTRAINT "Return_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
