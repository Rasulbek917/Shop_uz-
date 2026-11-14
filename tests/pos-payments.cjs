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
const inbox = require('../src/app/api/platform/requests/route.ts');
const shopApi = require('../src/app/api/shops/[id]/route.ts');
const { randomBytes } = require('node:crypto');
const gatewayApi = require('../src/app/api/shop/pos-gateway/route.ts');
const posApi = require('../src/app/api/pos/payments/route.ts');
const posStatus = require('../src/app/api/pos/payments/[id]/route.ts');
const posWebhook = require('../src/app/api/webhooks/tezcheck/pos/[shopId]/route.ts');
const { openCredentials, sealCredentials } = require('../src/lib/payments/pos-secrets.ts');
const { createHmac } = require('node:crypto');

(async () => {
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  const shops = [];
  const bills = new Map();
  const credentials = { token: 'aps_' + 'a'.repeat(32), cashDeskCode: 'cdk_ci_shop', webhookSecret: 'whsec_ci_only_' + 'b'.repeat(32) };
  let blockedCancel = false, loseCreateReply = false;
  const makeResponse = (data, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, options) => {
    assert.equal(new URL(url).host, 'api.tezcheck.uz');
    assert.equal(options.headers.Authorization, `Bearer ${credentials.token}`);
    assert.equal(options.headers['X-Cash-Desk-Code'], credentials.cashDeskCode);
    const path = new URL(url).pathname.replace('/api/merchant/v1', '');
    if (path === '/payment-methods') return makeResponse([{ provider_code: 'click', name: 'Click', currency: 'UZS', min_amount_minor: null, max_amount_minor: null }]);
    if (path === '/bills') {
      const body = JSON.parse(options.body);
      let bill = bills.get(body.external_reference);
      if (!bill) {
        bill = { id: `bill_${body.external_reference}`, external_reference: body.external_reference, amount_minor: body.amount_minor, currency: 'UZS', paid: false, livemode: false, environment: null, state: 'active' };
        bills.set(body.external_reference, bill);
      }
      if (loseCreateReply) { loseCreateReply = false; throw new Error('Simulated response timeout'); }
      return makeResponse({ bill, payment_url: `https://tezcheck.uz/pay/plk_${body.external_reference}` });
    }
    const bill = [...bills.values()].find(value => path.includes(value.id));
    assert.ok(bill, path);
    if (path.endsWith('/cancel')) {
      if (bill.paid || blockedCancel) return new Response(JSON.stringify({ error: { code: 'resource.state_invalid' } }), { status: 409 });
      bill.state = 'revoked';
      return makeResponse({ bill, cancelled: true });
    }
    return makeResponse({ bill, payment: bill.paid ? { id: `pay_${bill.external_reference}`, state: 'succeeded', amount_minor: bill.amount_minor, currency: 'UZS', livemode: bill.livemode, environment: bill.environment, refunded_amount_minor: 0 } : null });
  };
  try {
    for (let index = 0; index < 2; index++) {
      const shop = await prisma.shop.create({ data: { name: 'POS CI', adminName: 'Owner', phone: '0', address: 'CI', status: 'ACTIVE', planCode: 'PRO', subscriptionEndDate: new Date(originalNow() + 86400000) } });
      shops.push(shop);
      const user = await prisma.user.create({ data: { shopId: shop.id, role: 'SHOP_ADMIN', fullName: 'Owner', username: `pos-ci-${randomBytes(8).toString('hex')}`, passwordHash: 'test' } });
      shop.token = signJwtToken({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, shopId: shop.id, tokenVersion: user.tokenVersion });
    }
    const shop = shops[0];
    const request = (shop, method, body, path = '/api/pos/payments') => new NextRequest(`https://shop.example.uz${path}`, { method, headers: { cookie: `${getAuthCookieName()}=${shop.token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const configured = await gatewayApi.PUT(request(shop, 'PUT', credentials));
    assert.equal(configured.status, 200, JSON.stringify(await configured.clone().json()));
    const settings = await gatewayApi.GET(request(shop, 'GET'));
    const settingsText = JSON.stringify(await settings.json());
    assert.equal(settingsText.includes(credentials.token), false);
    assert.equal(settingsText.includes(credentials.webhookSecret), false);
    const secret = await prisma.posGateway.findUnique({ where: { shopId: shop.id } });
    assert.equal(secret.credentials.includes(credentials.token), false);
    assert.deepEqual(openCredentials(shop.id, secret.credentials), credentials);
    assert.throws(() => openCredentials(shops[1].id, secret.credentials));
    const product = await prisma.product.create({ data: { shopId: shop.id, name: 'POS sut', salePrice: 5000 } });
    const batch = await prisma.productBatch.create({ data: { shopId: shop.id, productId: product.id, batchNumber: 'POS-CI', initialQuantity: 20, currentQuantity: 20, salePrice: 5000, purchasePrice: 3000, expiryDate: new Date(originalNow() + 86400000) } });
    const customer = await prisma.customer.create({ data: { shopId: shop.id, name: 'CI buyer' } });
    const input = { idempotencyKey: 'POS-CI-' + randomBytes(16).toString('hex'), customerId: customer.id, paymentMethod: 'ELECTRONIC', paidAmount: 0, discountAmount: 0, expectedTotal: 10000, items: [{ productId: product.id, batchId: batch.id, quantity: 2, unitPrice: 5000, discount: 0 }] };
    const denied = await posApi.POST(request(shops[1], 'POST', input));
    assert.equal(denied.status, 400);
    const started = await Promise.all([posApi.POST(request(shop, 'POST', input)), posApi.POST(request(shop, 'POST', input))]);
    const starts = await Promise.all(started.map(response => response.json()));
    assert.deepEqual(started.map(response => response.status), [200, 200], JSON.stringify(starts));
    const order = starts[0].data;
    assert.equal(order.id, starts[1].data.id);
    assert.equal(bills.size, 1);
    assert.equal(await prisma.sale.count({ where: { shopId: shop.id, status: 'COMPLETED' } }), 0);
    assert.equal(await prisma.payment.count({ where: { shopId: shop.id } }), 0);
    assert.equal((await prisma.customer.findUnique({ where: { id: customer.id } })).totalSpent, 0);
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 18);
    const params = { params: { id: order.id } };
    assert.equal((await posStatus.GET(request(shops[1], 'GET'), params)).status, 404);
    const pending = await posStatus.GET(request(shop, 'GET'), params);
    assert.equal((await pending.json()).data.status, 'PENDING');
    const bill = bills.get(order.id);
    bill.paid = true; bill.livemode = false; bill.environment = 'test';
    clock += 2000;
    assert.equal((await posStatus.GET(request(shop, 'GET'), params)).status, 409);
    assert.equal(await prisma.payment.count({ where: { shopId: shop.id } }), 0);
    bill.livemode = true; bill.environment = 'live'; bill.amount_minor = 99;
    clock += 2000;
    assert.equal((await posStatus.GET(request(shop, 'GET'), params)).status, 409);
    assert.equal(await prisma.payment.count({ where: { shopId: shop.id } }), 0);
    bill.amount_minor = 1000000;
    clock += 2000;
    const raw = JSON.stringify({ type: 'payment.succeeded', data: { external_reference: order.id, bill_id: bill.id, environment: 'live' } });
    const timestamp = String(Math.floor(clock / 1000)), delivery = 'pos-ci-delivery';
    const signature = 'v1=' + createHmac('sha256', credentials.webhookSecret).update(`${timestamp}.${delivery}.${raw}`).digest('hex');
    const webhookRequest = (sign = signature) => new NextRequest('https://shop.example.uz/api/webhooks/tezcheck/pos/' + shop.id, { method: 'POST', headers: { 'x-checkout-timestamp': timestamp, 'x-checkout-delivery': delivery, 'x-checkout-signature': sign }, body: raw });
    assert.equal((await posWebhook.POST(webhookRequest('v1=' + '0'.repeat(64)), { params: { shopId: shop.id } })).status, 401);
    const confirms = await Promise.all([posStatus.GET(request(shop, 'GET'), params), posWebhook.POST(webhookRequest(), { params: { shopId: shop.id } })]);
    assert.deepEqual(confirms.map(response => response.status), [200, 200]);
    assert.equal((await confirms[0].json()).data.status, 'PAID');
    assert.equal(await prisma.payment.count({ where: { shopId: shop.id } }), 1);
    assert.equal((await prisma.customer.findUnique({ where: { id: customer.id } })).totalSpent, 10000);
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 18);
    const unsafeManual = await sales.POST(request(shop, 'POST', { ...input, idempotencyKey: 'manual-' + randomBytes(16).toString('hex'), paidAmount: 10000 }));
    assert.equal(unsafeManual.status, 409);
    // Simulate a lost response after the provider created the bill. Retry resumes the same bill and stock hold.
    const secondInput = { ...input, idempotencyKey: 'retry-' + randomBytes(16).toString('hex') };
    loseCreateReply = true;
    assert.equal((await posApi.POST(request(shop, 'POST', secondInput))).status, 200);
    const resumed = await posApi.POST(request(shop, 'POST', secondInput));
    assert.equal(resumed.status, 200, JSON.stringify(await resumed.clone().json()));
    const second = (await resumed.json()).data;
    assert.equal(bills.size, 2);
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 16);
    const secondParams = { params: { id: second.id } };
    blockedCancel = true;
    assert.equal((await posStatus.DELETE(request(shop, 'DELETE'), secondParams)).status, 409);
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 16);
    blockedCancel = false;
    const cancelled = await Promise.all([posStatus.DELETE(request(shop, 'DELETE'), secondParams), posStatus.DELETE(request(shop, 'DELETE'), secondParams)]);
    assert.deepEqual(cancelled.map(response => response.status), [200, 200]);
    assert.equal((await prisma.productBatch.findUnique({ where: { id: batch.id } })).currentQuantity, 18);
    assert.equal(await prisma.payment.count({ where: { shopId: shop.id } }), 1);
    console.log('POS database tests passed: per-shop encrypted credentials, scope isolation, stock reservation, concurrent deduplication, lost-response recovery, test/amount rejection, signed webhook confirmation, once-only settlement and cancellation rollback.');
  } finally {
    global.fetch = originalFetch;
    Date.now = originalNow;
    for (const shop of shops.reverse()) await prisma.shop.delete({ where: { id: shop.id } });
    await prisma.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
