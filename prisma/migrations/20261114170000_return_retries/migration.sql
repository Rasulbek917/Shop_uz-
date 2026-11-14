ALTER TABLE "Return" ADD COLUMN "cashRefundAmount" DOUBLE PRECISION, ADD COLUMN "creditAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0, ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "Return_idempotencyKey_key" ON "Return"("idempotencyKey");
CREATE TABLE "AuthThrottle" ("key" TEXT PRIMARY KEY, "attempts" INTEGER NOT NULL, "resetAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "AuthThrottle_resetAt_idx" ON "AuthThrottle"("resetAt");
