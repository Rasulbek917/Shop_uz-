ALTER TABLE "Debt" ADD COLUMN "clientReference" TEXT;
CREATE UNIQUE INDEX "Debt_clientReference_key" ON "Debt"("clientReference");
