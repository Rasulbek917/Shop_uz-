CREATE TABLE "PosGateway" (
 "shopId" TEXT PRIMARY KEY,
 "credentials" TEXT NOT NULL,
 "cashDeskCode" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PosGateway_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "PosPayment" (
 "id" TEXT PRIMARY KEY,
 "shopId" TEXT NOT NULL,
 "saleId" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "credentials" TEXT NOT NULL,
 "billId" TEXT,
 "paymentId" TEXT,
 "paymentUrl" TEXT,
 "returnUrl" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "paidAt" TIMESTAMP(3),
 CONSTRAINT "PosPayment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "PosPayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PosPayment_saleId_key" ON "PosPayment"("saleId");
CREATE UNIQUE INDEX "PosPayment_requestKey_key" ON "PosPayment"("requestKey");
CREATE UNIQUE INDEX "PosPayment_billId_key" ON "PosPayment"("billId");
CREATE UNIQUE INDEX "PosPayment_paymentId_key" ON "PosPayment"("paymentId");
CREATE INDEX "PosPayment_shopId_status_idx" ON "PosPayment"("shopId", "status");
