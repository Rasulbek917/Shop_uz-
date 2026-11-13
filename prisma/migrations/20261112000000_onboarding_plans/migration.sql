-- Additive migration: existing shops keep their LEGACY access.
ALTER TABLE "Shop" ADD COLUMN "planCode" TEXT NOT NULL DEFAULT 'LEGACY', ADD COLUMN "approvedAt" TIMESTAMP(3), ADD COLUMN "approvalNote" TEXT;
ALTER TABLE "User" ADD COLUMN "email" TEXT, ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "Plan" ("code" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "price" INTEGER NOT NULL DEFAULT 0, "enabled" BOOLEAN NOT NULL DEFAULT false, "paymentInstructions" TEXT NOT NULL DEFAULT '', "updatedAt" TIMESTAMP(3) NOT NULL);
INSERT INTO "Plan" ("code", "name", "updatedAt") VALUES ('PRO', 'Pro', CURRENT_TIMESTAMP), ('MAX', 'Max', CURRENT_TIMESTAMP);
CREATE TABLE "PurchaseRequest" ("id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "planCode" TEXT NOT NULL, "amount" INTEGER NOT NULL, "reference" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "reviewNote" TEXT, "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PurchaseRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "PurchaseRequest_shopId_status_idx" ON "PurchaseRequest"("shopId", "status");
CREATE INDEX "PurchaseRequest_status_createdAt_idx" ON "PurchaseRequest"("status", "createdAt");
