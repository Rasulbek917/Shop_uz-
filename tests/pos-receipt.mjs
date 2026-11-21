import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const database = new URL(process.env.DATABASE_URL);
assert.equal(process.env.CI, "true");
assert.ok(["localhost", "127.0.0.1"].includes(database.hostname));
assert.equal(database.pathname, "/savdoza_test");

const prisma = new PrismaClient();
const output = "/tmp/pos-receipt-check";
mkdirSync(output, { recursive: true });
let server;
let browser;
let page;
let shop;

try {
  shop = await prisma.shop.create({
    data: {
      name: "Chek sinovi",
      adminName: "Sinov foydalanuvchi",
      phone: "+998900000000",
      address: "Sinov manzili",
      status: "ACTIVE",
      planCode: "MAX",
      subscriptionType: "MAX",
      subscriptionEndDate: new Date(Date.now() + 30 * 86400000),
    },
  });
  const username = `receipt_test_${Date.now()}`;
  await prisma.user.create({
    data: {
      shopId: shop.id,
      role: "SHOP_ADMIN",
      fullName: "Sinov foydalanuvchi",
      username,
      passwordHash: await bcrypt.hash("Receipt-Test-2026!", 10),
    },
  });
  const product = await prisma.product.create({
    data: { shopId: shop.id, name: "Sinov mahsulot", salePrice: 10000, unit: "dona" },
  });
  const batch = await prisma.productBatch.create({
    data: {
      shopId: shop.id,
      productId: product.id,
      batchNumber: "RECEIPT-TEST",
      purchasePrice: 6000,
      salePrice: 10000,
      initialQuantity: 20,
      currentQuantity: 20,
      expiryDate: new Date(Date.now() + 180 * 86400000),
    },
  });

  server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3000",
  ], { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch("http://localhost:3000/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Test server did not start");
  browser = await chromium.launch(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    window.printCalls = 0;
    window.print = () => {
      window.printCalls++;
      window.dispatchEvent(new Event("afterprint"));
    };
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto("http://localhost:3000/login");
  await page.getByPlaceholder("Loginingiz").fill(username);
  await page.getByPlaceholder("Parolingiz").fill("Receipt-Test-2026!");
  await Promise.all([
    page.waitForURL("**/admin"),
    page.getByRole("button", { name: "Kirish", exact: true }).click(),
  ]);
  const openedShift = await page.request.post("http://localhost:3000/api/shifts", { data: { openingCash: 0 } });
  assert.equal(openedShift.status(), 201, await openedShift.text());
  await page.goto("http://localhost:3000/admin/pos");

  const cases = [
    { method: "CASH", label: "Naqd pul", width: 1280, height: 800 },
    { method: "CARD", label: "Bank kartasi", width: 390, height: 640 },
    { method: "ELECTRONIC", label: "Elektron to‘lov", width: 844, height: 390 },
  ];
  for (const [index, test] of cases.entries()) {
    await page.setViewportSize({ width: test.width, height: test.height });
    // QR service failure must not prevent printing an already saved receipt.
    if (index === 2) {
      await page.route("**/api/receipts/link?**", route => route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { message: "QR vaqtincha mavjud emas" } }),
      }));
    }
    await page.locator(".terminal-add").first().click();
    const method = page.locator(".terminal-payment-shortcuts button").nth(index);
    await method.click();
    assert.equal(await method.getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "To‘lovni qabul qilish", exact: true }).click();
    assert.equal(await page.getByRole("heading", { name: new RegExp(test.label) }).isVisible(), true);
    const response = page.waitForResponse(response =>
      response.url().endsWith("/api/sales") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Sotuvni Yakunlash va Chek Chiqarish", exact: true }).click();
    const result = await (await response).json();
    assert.equal(result.success, true, JSON.stringify(result));
    assert.equal(result.data.paymentMethod, test.method);
    const dialog = page.getByRole("dialog", { name: "Sotuv cheki" });
    await dialog.waitFor();
    const print = dialog.getByRole("button", { name: "Chek chiqarish", exact: true });
    const next = dialog.getByRole("button", { name: "Yangi savdo", exact: true });
    for (const button of [print, next]) {
      const bounds = await button.boundingBox();
      assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= test.height,
        test.method + ": receipt action is outside viewport");
    }
    assert.equal(await print.isEnabled(), true);
    await print.click();
    assert.equal(await page.evaluate(() => window.printCalls), index + 1);
    assert.equal(await page.evaluate(() => document.body.classList.contains("printing-receipt")), false);
    await next.click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.getByText("Chek bo‘sh", { exact: true }).isVisible(), true);
    console.log(test.method + ": sale, receipt, print and new sale passed");
  }
  assert.equal(await prisma.sale.count({ where: { shopId: shop.id } }), 3);
  assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 17);
} catch (error) {
  await page?.screenshot({ path: output + "/failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  if (shop) {
    await prisma.return.deleteMany({ where: { shopId: shop.id } });
    await prisma.sale.deleteMany({ where: { shopId: shop.id } });
    await prisma.payment.deleteMany({ where: { shopId: shop.id } });
    await prisma.shop.delete({ where: { id: shop.id } });
  }
  await prisma.$disconnect();
}
