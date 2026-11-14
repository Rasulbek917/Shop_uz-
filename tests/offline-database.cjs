const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/savdoza_test') throw new Error('Alohida local savdoza_test bazasi kerak');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve('src', request.slice(2)) : request, parent, ...args);
};
Module._extensions['.ts'] = function(module, filename) {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const { NextRequest } = require('next/server');
const { prisma } = require('../src/lib/prisma.ts');
const { signJwtToken, getAuthCookieName } = require('../src/lib/auth.ts');
const sales = require('../src/app/api/sales/route.ts');
const debts = require('../src/app/api/debts/sale/route.ts');
const { randomBytes } = require('node:crypto');
(async () => {
  let shop;
  try {
    shop = await prisma.shop.create({ data: { name: 'Offline CI', adminName: 'CI owner', phone: '+998000000000', address: 'CI database', status: 'ACTIVE', planCode: 'PRO', subscriptionEndDate: new Date(Date.now() + 86400000) } });
    const user = await prisma.user.create({ data: { shopId: shop.id, role: 'SHOP_ADMIN', fullName: 'CI owner', username: `ci-${randomBytes(8).toString('hex')}`, passwordHash: 'isolated-test-hash' } });
    const product = await prisma.product.create({ data: { shopId: shop.id, name: 'Test sut', salePrice: 5000 } });
    const batch = await prisma.productBatch.create({ data: { shopId: shop.id, productId: product.id, batchNumber: 'CI', initialQuantity: 100, currentQuantity: 100, salePrice: 5000, purchasePrice: 3000, expiryDate: new Date(Date.now() + 86400000) } });
    const token = signJwtToken({ id: user.id, username: user.username, fullName: user.fullName, role: 'SHOP_ADMIN', shopId: shop.id, tokenVersion: user.tokenVersion });
    const request = (route, body) => new NextRequest(`https://shop.example.uz/api/${route}`, { method: 'POST', headers: { cookie: `${getAuthCookieName()}=${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const base = { paymentMethod: 'CASH', paidAmount: 10000, discountAmount: 0, expectedTotal: 10000, occurredAt: new Date(Date.now() - 10000).toISOString(), items: [{ productId: product.id, batchId: batch.id, quantity: 2, unitPrice: 5000, discount: 0 }] };
    const key = () => `MOB-${randomBytes(32).toString('hex')}`;
    const cash = { ...base, idempotencyKey: key() };
    const responses = await Promise.all([sales.POST(request('sales', cash)), sales.POST(request('sales', cash))]);
    const bodies = await Promise.all(responses.map(response => response.json()));
    assert.deepEqual(responses.map(response => response.status), [200, 200], JSON.stringify(bodies));
    assert.equal(bodies[0].data.id, bodies[1].data.id);
    assert.equal(await prisma.sale.count({ where: { shopId: shop.id } }), 1);
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 98);
    const conflict = await sales.POST(request('sales', { ...cash, items: [{ ...cash.items[0], quantity: 3 }] }));
    assert.equal(conflict.status, 400);
    const quote = await sales.POST(request('sales', { ...base, idempotencyKey: key(), expectedTotal: 9000 }));
    assert.equal(quote.status, 400);
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 98);
    const debt = { ...base, idempotencyKey: key(), firstName: 'Test', lastName: 'Customer', phone: '+998000000000' };
    const debtResponses = await Promise.all([debts.POST(request('debts/sale', debt)), debts.POST(request('debts/sale', debt))]);
    const debtBodies = await Promise.all(debtResponses.map(response => response.json()));
    assert.deepEqual(debtResponses.map(response => response.status), [200, 200], JSON.stringify(debtBodies));
    assert.equal(debtBodies[0].data.id, debtBodies[1].data.id);
    assert.equal(await prisma.debt.count({ where: { shopId: shop.id } }), 1);
    assert.equal(await prisma.sale.count({ where: { shopId: shop.id } }), 2);
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 96);
    const occurredAt = new Date(Date.now() - 3600000);
    await prisma.productBatch.update({ where: { id: batch.id }, data: { expiryDate: new Date(Date.now() - 1800000) } });
    const late = await sales.POST(request('sales', { ...base, idempotencyKey: key(), occurredAt: occurredAt.toISOString() }));
    assert.equal(late.status, 200, JSON.stringify(await late.clone().json()));
    const lateBody = await late.json();
    assert.equal(new Date(lateBody.data.createdAt).toISOString(), occurredAt.toISOString());
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 94);
    await prisma.shop.update({ where: { id: shop.id }, data: { status: 'EXPIRED' } });
    const blocked = await sales.POST(request('sales', { ...base, idempotencyKey: key() }));
    assert.equal(blocked.status, 403);
    assert.equal(await prisma.sale.count({ where: { shopId: shop.id } }), 3);
    console.log('Database integration passed: concurrent cash/debt deduplication, stock rollback, quote conflicts, original offline date, expired account guard.');
  } finally {
    if (shop) await prisma.shop.delete({ where: { id: shop.id } });
    await prisma.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
