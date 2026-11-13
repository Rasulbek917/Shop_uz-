CREATE TABLE "CheckoutOrder" (
 "id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "planCode" TEXT NOT NULL, "amount" INTEGER NOT NULL,
 "providerCode" TEXT NOT NULL, "activeKey" TEXT, "billId" TEXT, "paymentId" TEXT, "paymentUrl" TEXT,
 "returnUrl" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paidAt" TIMESTAMP(3),
 CONSTRAINT "CheckoutOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CheckoutOrder_activeKey_key" ON "CheckoutOrder"("activeKey");
CREATE UNIQUE INDEX "CheckoutOrder_billId_key" ON "CheckoutOrder"("billId");
CREATE UNIQUE INDEX "CheckoutOrder_paymentId_key" ON "CheckoutOrder"("paymentId");
CREATE INDEX "CheckoutOrder_shopId_status_idx" ON "CheckoutOrder"("shopId", "status");
