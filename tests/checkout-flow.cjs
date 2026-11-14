const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');

// Execute the application modules with isolated provider/database doubles.
function load(file, mocks = {}) {
  const filename = path.resolve(file);
  const requireFile = createRequire(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const timer = (callback, milliseconds) => {
    const handle = setTimeout(callback, milliseconds);
    handle.unref();
    return handle;
  };
  new Function('require', 'exports', 'module', 'setTimeout', compiled)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : requireFile(name), module.exports, module, timer,
  );
  return module.exports;
}
const security = load('src/lib/payments/tezcheck-security.ts');
const { BusinessError, registrationSchema } = load('src/lib/onboarding.ts');
const { hasShopAccess, isMax } = load('src/lib/plans.ts');
function payments(db) {
  return load('src/lib/payments/tezcheck.ts', {
    '@/lib/prisma': { prisma: db }, '@/lib/onboarding': { BusinessError }, './tezcheck-security': security,
  });
}
function configure(t) {
  const before = { ...process.env };
  process.env.TEZCHECK_API_TOKEN = 'isolated-test-api-token';
  process.env.TEZCHECK_CASH_DESK_CODE = 'isolated-test-desk';
  process.env.APP_URL = 'https://shop.example.uz';
  t.after(() => { process.env = before; });
}

test('unpaid and expired shops stay locked while active subscriptions work', () => {
  const future = new Date(Date.now() + 86400000);
  const past = new Date(Date.now() - 86400000);
  for (const status of ['AWAITING_PAYMENT', 'PENDING', 'BLOCKED', 'REJECTED', 'DELETED', 'EXPIRED']) {
    assert.equal(hasShopAccess({ status, planCode: 'MAX', subscriptionEndDate: future }), false);
  }
  assert.equal(hasShopAccess({ status: 'ACTIVE', planCode: 'PRO', subscriptionEndDate: past }), false);
  assert.equal(hasShopAccess({ status: 'ACTIVE', planCode: 'PRO' }), false);
  assert.equal(hasShopAccess({ status: 'ACTIVE', planCode: 'PRO', subscriptionEndDate: future }), true);
  assert.equal(hasShopAccess({ status: 'TRIAL', trialEndDate: past }), false);
  assert.equal(isMax('PRO'), false);
  assert.equal(isMax('MAX'), true);
});

test('registration normalizes login and rejects invalid identity data', () => {
  const input = { planCode: 'PRO', fullName: 'Test User', shopName: 'Test shop', username: ' Test.User ', password: 'strongPassword123', phone: '+998 (90) 123-45-67', email: 'TEST@example.uz', consent: true };
  const result = registrationSchema.parse(input);
  assert.equal(result.username, 'test.user');
  assert.equal(result.phone, '+998901234567');
  assert.equal(result.email, 'test@example.uz');
  for (const patch of [{ username: 'кирилл' }, { phone: '1234' }, { email: 'invalid' }, { password: 'short' }, { consent: false }]) {
    assert.equal(registrationSchema.safeParse({ ...input, ...patch }).success, false);
  }
});

test('checkout creates a linked return URL and reuses the existing bill', async t => {
  configure(t);
  let order;
  const requests = [];
  const db = {
    shop: { findUnique: async () => ({ status: 'AWAITING_PAYMENT' }) },
    plan: { findUnique: async () => ({ enabled: true, price: 299000 }) },
    checkoutOrder: {
      findUnique: async () => order || null,
      create: async ({ data }) => (order = { ...data, status: 'PENDING', createdAt: new Date() }),
      update: async ({ data }) => Object.assign(order, data),
    },
  };
  t.mock.method(global, 'fetch', async (url, options) => {
    requests.push({ url: String(url), ...options });
    const data = String(url).endsWith('/payment-methods')
      ? [{ provider_code: 'payme', name: 'Payme', currency: 'UZS', min_amount_minor: null, max_amount_minor: null }]
      : { bill: { id: 'bill-1', external_reference: order.id, amount_minor: 29900000, currency: 'UZS' }, payment_url: 'https://tezcheck.uz/pay/test-only' };
    return Response.json({ data });
  });
  const api = payments(db);
  const first = await api.createCheckout('shop-1', 'PRO', 'payme');
  assert.equal(new URL(order.returnUrl).searchParams.get('order'), first.id);
  assert.equal(new URL(order.returnUrl).searchParams.get('plan'), 'PRO');
  const billRequest = requests.find(request => request.url.endsWith('/bills'));
  assert.equal(JSON.parse(billRequest.body).external_reference, order.id);
  assert.equal(JSON.parse(billRequest.body).return_url, order.returnUrl);
  assert.equal(billRequest.headers['Idempotency-Key'], `savdoza-${order.id}`);
  assert.deepEqual(await api.createCheckout('shop-1', 'PRO', 'payme'), first);
  assert.equal(requests.filter(request => request.url.endsWith('/bills')).length, 1);
});

test('verified payment activates once and extends an existing subscription', async t => {
  configure(t);
  const end = new Date(Date.now() + 5 * 86400000);
  const order = { id: 'order-1', shopId: 'shop-1', billId: 'bill-1', amount: 299000, planCode: 'PRO', status: 'PENDING' };
  const shop = { id: 'shop-1', planCode: 'PRO', status: 'ACTIVE', subscriptionEndDate: end };
  const subscriptions = [];
  const db = {
    checkoutOrder: {
      findUnique: async () => order,
      updateMany: async ({ where, data }) => {
        if (!where.status.in.includes(order.status)) return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      },
    },
    shop: { findUniqueOrThrow: async () => shop, update: async ({ data }) => Object.assign(shop, data) },
    subscription: { create: async ({ data }) => subscriptions.push(data) },
    auditLog: { create: async () => {} },
    $transaction: async callback => callback(db),
  };
  t.mock.method(global, 'fetch', async () => Response.json({ data: {
    bill: { id: 'bill-1', external_reference: 'order-1', amount_minor: 29900000, currency: 'UZS', paid: true, livemode: true, environment: 'live' },
    payment: { id: 'payment-1', state: 'succeeded', amount_minor: 29900000, currency: 'UZS', livemode: true, environment: 'live', refunded_amount_minor: 0 },
  } }));
  const api = payments(db);
  assert.deepEqual(await api.reconcileCheckout(order.id), { status: 'PAID' });
  assert.deepEqual(await api.reconcileCheckout(order.id), { status: 'PAID' });
  assert.equal(subscriptions.length, 1);
  assert.equal(shop.subscriptionEndDate.getTime(), end.getTime() + 30 * 86400000);
});

test('checkout status refuses another shop order before contacting provider', async () => {
  let queried;
  const route = load('src/app/api/checkout/[id]/route.ts', {
    '@/lib/tenant': { requireApiAuth: async () => ({ user: { shopId: 'own-shop' } }) },
    '@/lib/prisma': { prisma: { checkoutOrder: { findFirst: async query => { queried = query; return null; } } } },
    '@/lib/payments/tezcheck': { reconcileCheckout: async () => assert.fail('Foreign order must be rejected') },
    '@/lib/platform-api': { platformError: error => { throw error; } },
  });
  const response = await route.GET(new Request('https://shop.example.uz/api/checkout/foreign'), { params: { id: 'foreign' } });
  assert.equal(response.status, 404);
  assert.deepEqual(queried.where, { id: 'foreign', shopId: 'own-shop' });
});

test('client API handles offline, HTML errors and expired sessions', async t => {
  const { clientApi } = load('src/lib/client-api.ts');
  t.mock.method(global, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(clientApi('/test'), /Internet aloqasini/);
  global.fetch = async () => new Response('<html>upstream error</html>', { status: 502 });
  await assert.rejects(clientApi('/test'), /Server javobi olinmadi/);
  const before = global.window;
  let redirect;
  global.window = { location: { assign: value => { redirect = value; } } };
  t.after(() => { global.window = before; });
  global.fetch = async () => Response.json({ success: false, error: 'Login kerak' }, { status: 401 });
  await assert.rejects(clientApi('/test'), /Login kerak/);
  assert.equal(redirect, '/login');
});

test('unpaid account can authenticate but product and sale APIs return 403', async () => {
  const { NextRequest } = require('next/server');
  const shop = { id: 'shop-1', status: 'AWAITING_PAYMENT', planCode: 'NONE' };
  const user = { id: 'user-1', role: 'SHOP_ADMIN', shopId: shop.id, hasAccess: false };
  const tenant = load('src/lib/tenant.ts', {
    './plans': load('src/lib/plans.ts'),
    './auth': { verifyJwtToken: () => user, resolveUser: async () => user, getAuthCookieName: () => 'session' },
    './prisma': { prisma: { shop: { findUnique: async () => shop } } },
  });
  const request = new NextRequest('https://shop.example.uz/api/products', { method: 'POST', headers: { authorization: 'Bearer test' } });
  const auth = await tenant.requireApiAuth(request);
  assert.equal(auth.user.id, user.id);
  assert.equal(auth.errorResponse, undefined);
  for (const file of ['src/app/api/products/route.ts', 'src/app/api/sales/route.ts']) {
    const route = load(file, {
      '@/lib/tenant': tenant,
      '@/lib/prisma': { prisma: new Proxy({}, { get() { assert.fail('Unpaid shop must not perform business queries'); } }) },
      '@/lib/refunds': {}, '@/lib/sale-replay': {}, '@/lib/validations': {}, '@/lib/audit': {}, '@/lib/logger': { logger: { error() {} } }, '@/lib/receipt': {},
    });
    const response = await route.POST(request);
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.needsSubscription, true);
    assert.match(body.error, /Tarifni yangilang/);
  }
});

test('account restores payment history from its own shop without exposing provider links', async () => {
  let shopQuery;
  const route = load('src/app/api/account/route.ts', {
    '@/lib/tenant': { requireApiAuth: async () => ({ user: { shopId: 'own-shop' } }) },
    '@/lib/prisma': { prisma: {
      shop: { findUnique: async query => { shopQuery = query; return { id: 'own-shop', checkoutOrders: [{ id: 'saved-order', planCode: 'PRO', status: 'PENDING' }] }; } },
      plan: { findMany: async () => [] },
    } },
    '@/lib/platform-api': { platformError: error => { throw error; } },
  });
  const response = await route.GET(new Request('https://shop.example.uz/api/account'));
  assert.equal(response.status, 200);
  assert.equal(shopQuery.where.id, 'own-shop');
  assert.equal(shopQuery.include.checkoutOrders.select.paymentUrl, undefined);
  assert.equal((await response.json()).data.shop.checkoutOrders[0].id, 'saved-order');
});

test('public header restores the account and keeps it during a temporary server error', async t => {
  let state;
  let effect;
  const listeners = new Map();
  const beforeDocument = global.document;
  const beforeWindow = global.window;
  global.document = { visibilityState: 'visible', addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener() {} };
  global.window = { addEventListener() {}, removeEventListener() {} };
  t.after(() => { global.document = beforeDocument; global.window = beforeWindow; });
  const { PublicHeader } = load('src/components/marketing/PublicShell.tsx', {
    react: { useState: () => [state, value => { state = value; }], useEffect: callback => { effect = callback; } },
    'next/link': { __esModule: true, default: props => require('react').createElement('a', props, props.children) },
  });
  const render = () => require('react-dom/server').renderToStaticMarkup(PublicHeader({}));
  assert.match(render(), /Hisobim/);
  assert.doesNotMatch(render(), />Kirish</);
  t.mock.method(global, 'fetch', async () => Response.json({ success: true, user: { username: 'test.user', planCode: 'PRO' } }));
  const cleanup = effect();
  await new Promise(setImmediate);
  assert.match(render(), /test.user/);
  assert.match(render(), /Hisobim/);
  assert.doesNotMatch(render(), />Kirish</);
  global.fetch = async () => new Response('Unavailable', { status: 503 });
  await listeners.get('visibilitychange')();
  assert.match(render(), /test.user/);
  global.fetch = async () => Response.json({ success: false }, { status: 401 });
  await listeners.get('visibilitychange')();
  assert.match(render(), />Kirish</);
  cleanup();
});

test('Pro menu shows disabled Max sections and Max menu enables them', () => {
  const { default: Sidebar } = load('src/components/layout/Sidebar.tsx', {
    'next/navigation': { usePathname: () => '/admin' },
    '@/lib/plans': { isMax },
  });
  const React = require('react');
  const render = planCode => require('react-dom/server').renderToStaticMarkup(React.createElement(Sidebar, {
    user: { role: 'SHOP_ADMIN', planCode }, isOpen: true, onClose() {},
  }));
  const pro = render('PRO');
  assert.equal((pro.match(/<button[^>]*\sdisabled=""/g) || []).length, 3);
  for (const label of ['Xodimlar boshqaruvi', 'Yetkazib beruvchilar', 'Amallar jurnali']) assert.ok(pro.includes(label));
  assert.ok(pro.includes('Max tarifiga o‘ting'));
  assert.doesNotMatch(pro, /href="\/admin\/xodimlar"/);
  const max = render('MAX');
  assert.match(max, /href="\/admin\/xodimlar"/);
  assert.match(max, /href="\/admin\/yetkazib-beruvchilar"/);
  assert.match(max, /href="\/admin\/audit-log"/);
});

test('profile edits preserve session version and password change renews the current session', async t => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-session-regression-secret-123456';
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  const user = { id: 'user-1', username: 'test.user', fullName: 'Test User', role: 'SHOP_ADMIN', shopId: 'shop-1', tokenVersion: 7, status: 'ACTIVE', shop: { status: 'AWAITING_PAYMENT', planCode: 'NONE' } };
  const db = { user: {
    findUnique: async () => user,
    update: async ({ data }) => {
      Object.assign(user, { ...data, tokenVersion: data.tokenVersion?.increment ? user.tokenVersion + data.tokenVersion.increment : user.tokenVersion });
      return user;
    },
  } };
  const auth = load('src/lib/auth.ts', { './prisma': { prisma: db }, './plans': { hasShopAccess, isMax } });
  const initialToken = auth.signJwtToken({ ...user });
  const routeMocks = {
    '@/lib/prisma': { prisma: db },
    '@/lib/auth': { ...auth, getCurrentUser: async () => ({ ...user }), comparePassword: async () => true, hashPassword: async () => 'test-hash' },
    '@/lib/validations': load('src/lib/validations.ts'),
    '@/lib/audit': { logAudit: async () => {} }, '@/lib/logger': { logger: { error() {} } },
    '@/lib/formatters': {},
  };
  const profile = load('src/app/api/profile/route.ts', routeMocks);
  const saved = await profile.PATCH(new Request('https://shop.example.uz/api/profile', { method: 'PATCH', body: JSON.stringify({ fullName: 'Updated User' }) }));
  assert.equal(saved.status, 200);
  const profileToken = saved.cookies.get(auth.getAuthCookieName()).value;
  assert.equal(auth.verifyJwtToken(profileToken).tokenVersion, 7);
  assert.ok(await auth.resolveUser(auth.verifyJwtToken(profileToken)));
  const password = load('src/app/api/auth/change-password/route.ts', routeMocks);
  const changed = await password.POST(new Request('https://shop.example.uz/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'oldPassword123', newPassword: 'newPassword123', confirmPassword: 'newPassword123' }) }));
  assert.equal(changed.status, 200);
  const freshToken = changed.cookies.get(auth.getAuthCookieName()).value;
  assert.equal(auth.verifyJwtToken(freshToken).tokenVersion, 8);
  assert.ok(await auth.resolveUser(auth.verifyJwtToken(freshToken)));
  assert.equal(await auth.resolveUser(auth.verifyJwtToken(initialToken)), null);
});

test('unrelated 401 responses and temporary session errors do not redirect to login', async t => {
  const { clientApi } = load('src/lib/client-api.ts');
  const before = global.window;
  global.window = { location: { assign: () => assert.fail('An authenticated session must stay on the current page') } };
  t.after(() => { global.window = before; });
  t.mock.method(global, 'fetch', async url => url === '/api/auth/me'
    ? Response.json({ success: true, user: { id: 'user-1' } })
    : Response.json({ success: false, error: 'Joriy parol noto‘g‘ri' }, { status: 401 }));
  await assert.rejects(clientApi('/api/auth/change-password'), /Joriy parol/);
  global.fetch = async url => url === '/api/auth/me'
    ? new Response('Unavailable', { status: 503 })
    : Response.json({ success: false, error: 'Urinib ko‘ring' }, { status: 401 });
  await assert.rejects(clientApi('/test'), /Urinib ko‘ring/);
});

test('Max APIs refuse Pro and accept Max on the server', async () => {
  const { NextRequest } = require('next/server');
  const plans = load('src/lib/plans.ts');
  const user = { id: 'user-1', shopId: 'shop-1', role: 'SHOP_ADMIN', hasAccess: true };
  const shop = { id: 'shop-1', status: 'ACTIVE', planCode: 'PRO', subscriptionEndDate: new Date(Date.now() + 86400000) };
  const tenant = load('src/lib/tenant.ts', {
    './plans': plans,
    './auth': { getAuthCookieName: () => 'session', verifyJwtToken: () => user, resolveUser: async () => user },
    './prisma': { prisma: { shop: { findUnique: async () => shop } } },
  });
  for (const path of plans.MAX_API_PREFIXES) {
    shop.planCode = 'PRO';
    const request = new NextRequest(`https://shop.example.uz${path}`, { headers: { authorization: 'Bearer test' } });
    const locked = await tenant.requireTenantContext(request);
    assert.equal(locked.errorResponse.status, 403);
    assert.equal((await locked.errorResponse.json()).requiredPlan, 'MAX');
    shop.planCode = 'MAX';
    assert.equal((await tenant.requireTenantContext(request)).context.shopId, shop.id);
  }
});

test('central import buttons remain visible and locked for Pro', () => {
  const React = require('react');
  let canImport = false;
  let stateIndex = 0;
  const states = () => [1000, 1, false, null, canImport];
  const { default: CentralProductModal } = load('src/components/pos/CentralProductModal.tsx', {
    react: { ...React, useState: () => [states()[stateIndex++], () => {}], useEffect() {} },
    '@/lib/plans': { isMax }, '@/lib/formatters': { formatCurrency: value => String(value) },
    'next/link': { __esModule: true, default: props => React.createElement('a', props, props.children) },
  });
  const render = () => {
    stateIndex = 0;
    return require('react-dom/server').renderToStaticMarkup(CentralProductModal({
      isOpen: true, onClose() {}, onImportSuccess() {},
      centralProduct: { id: 'product-1', sku: 'sku-1', name: 'Sample', price: 1000, shopName: 'Shop', barcodeType: 'EAN13', barcodeValue: '123', status: 'ACTIVE' },
    }));
  };
  assert.equal((render().match(/<button[^>]*\sdisabled=""/g) || []).length, 2);
  assert.ok(render().includes('Max tarifiga o‘ting'));
  canImport = true;
  assert.equal((render().match(/<button[^>]*\sdisabled=""/g) || []).length, 0);
});

test('receipt QR tokens reject tampering and bind to the canonical website', t => {
  const before = { ...process.env };
  process.env.JWT_SECRET = 'isolated-receipt-test-secret-123456789';
  delete process.env.RECEIPT_SIGNING_SECRET;
  process.env.APP_URL = 'https://shop.example.uz';
  t.after(() => { process.env = before; });
  const { receiptToken, receiptId, receiptUrl } = load('src/lib/receipt-share.ts');
  const token = receiptToken('sale-1');
  assert.equal(receiptId(token), 'sale-1');
  assert.equal(receiptId(token.replace('sale-1', 'sale-2')), null);
  assert.equal(receiptId(token + 'x'), null);
  assert.equal(receiptId('../secret'), null);
  assert.equal(receiptUrl('sale-1'), `https://shop.example.uz/chek/${token}`);
  assert.throws(() => receiptToken('../secret'));
});

test('public receipt renders a real PNG and keeps buyer data private', async t => {
  const before = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-receipt-test-secret-123456789';
  t.after(() => { if (before === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = before; });
  const signing = load('src/lib/receipt-share.ts');
  const formatting = load('src/lib/formatters.ts');
  let selected;
  const receipt = { receiptNumber: 'CHK-001', createdAt: new Date('2026-11-12T20:00:00Z'), totalAmount: 20000, discountAmount: 0, taxAmount: 0, payableAmount: 20000, paymentMethod: 'CASH', status: 'COMPLETED', shop: { name: 'Test & Shop' }, items: [{ quantity: 2, unitPrice: 10000, totalPrice: 20000, product: { name: 'Молоко O‘zbekcha <script>' } }] };
  const api = load('src/lib/public-receipt.ts', {
    '@/lib/prisma': { prisma: { sale: { findUnique: async query => { selected = query.select; return receipt; } } } },
    './receipt-share': signing, './formatters': formatting,
  });
  const renderer = load('src/lib/receipt-image.ts', { './formatters': formatting });
  const png = Buffer.from(await renderer.receiptImage(receipt));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 640);
  assert.ok(png.readUInt32BE(20) > 400);
  assert.match(formatting.receiptDate(receipt.createdAt), /13.11.2026.*01:00:00/);
  fs.writeFileSync('/tmp/savdoza-receipt-test.png', png);
  return api.publicReceipt(signing.receiptToken('sale-1')).then(result => {
    assert.equal(result.receiptNumber, 'CHK-001');
    assert.equal(selected.customer, undefined);
    assert.equal(selected.cashier, undefined);
    assert.equal(selected.shop.select.phone, undefined);
  });
});

test('receipt filters cover whole Tashkent days and CSV cells prevent formulas', () => {
  const { receiptFilters, csvCell } = load('src/lib/receipt-filters.ts');
  const { where, page } = receiptFilters(new URLSearchParams('from=2026-11-13&to=2026-11-13&page=5&search=CHK'), 'own-shop', 'own-cashier');
  assert.equal(page, 5);
  assert.equal(where.shopId, 'own-shop');
  assert.equal(where.cashierId, 'own-cashier');
  assert.equal(where.createdAt.gte.toISOString(), '2026-11-12T19:00:00.000Z');
  assert.equal(where.createdAt.lt.toISOString(), '2026-11-13T19:00:00.000Z');
  assert.throws(() => receiptFilters(new URLSearchParams('from=2026-02-31'), 'shop'));
  assert.throws(() => receiptFilters(new URLSearchParams('from=2026-11-14&to=2026-11-13'), 'shop'));
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell('a,b'), '"a,b"');
});

test('receipt link issuance is scoped to the cashier and shop', async () => {
  let query;
  const route = load('src/app/api/receipts/link/route.ts', {
    '@/lib/prisma': { prisma: { sale: { findFirst: async value => { query = value; return null; } } } },
    '@/lib/tenant': { requireTenantContext: async () => ({ context: { shopId: 'own-shop', user: { role: 'CASHIER', id: 'own-cashier' } } }) },
    '@/lib/receipt-share': { receiptUrl: () => assert.fail('A foreign receipt cannot receive a sharing link') },
    '@/lib/platform-api': { platformError: error => { throw error; } },
  });
  const { NextRequest } = require('next/server');
  const response = await route.GET(new NextRequest('https://shop.example.uz/api/receipts/link?receiptNumber=CHK-001'));
  assert.equal(response.status, 404);
  assert.deepEqual(query.where, { receiptNumber: 'CHK-001', shopId: 'own-shop', cashierId: 'own-cashier' });
});

test('receipt history paginates beyond the first hundred records', async () => {
  let query;
  const route = load('src/app/api/receipts/route.ts', {
    '@/lib/prisma': { prisma: {
      sale: { findMany: async value => { query = value; return [{ id: 'sale-101' }]; }, count: async () => 123 },
      $transaction: values => Promise.all(values),
    } },
    '@/lib/tenant': { requireTenantContext: async () => ({ context: { shopId: 'own-shop', user: { role: 'SHOP_ADMIN' } } }) },
    '@/lib/receipt-filters': load('src/lib/receipt-filters.ts'),
    '@/lib/platform-api': { platformError: error => { throw error; } },
  });
  const { NextRequest } = require('next/server');
  const response = await route.GET(new NextRequest('https://shop.example.uz/api/receipts?page=5'));
  const body = await response.json();
  assert.equal(body.data.total, 123);
  assert.equal(query.skip, 100);
  assert.equal(query.take, 25);
  assert.equal(query.where.shopId, 'own-shop');
});

test('category editing stays tenant-scoped and occupied categories cannot be deleted', async () => {
  let where;
  let count = 2;
  const route = load('src/app/api/categories/[id]/route.ts', {
    '@/lib/prisma': { prisma: { category: {
      updateMany: async query => { where = query.where; return { count: 0 }; },
      findFirst: async () => ({ _count: { products: count } }),
      deleteMany: async () => { assert.equal(count, 0); return { count: 0 }; },
    } } },
    '@/lib/tenant': { requireTenantContext: async () => ({ context: { shopId: 'own-shop', user: { id: 'user-1' } } }) },
    '@/lib/validations': load('src/lib/validations.ts'),
    '@/lib/platform-api': { platformError: error => { throw error; } },
  });
  const edited = await route.PATCH(new Request('https://shop.example.uz/api/categories/foreign', { method: 'PATCH', body: JSON.stringify({ name: 'Changed' }) }), { params: { id: 'foreign' } });
  assert.equal(edited.status, 404);
  assert.deepEqual(where, { id: 'foreign', shopId: 'own-shop' });
  assert.equal((await route.DELETE(new Request('https://shop.example.uz'), { params: { id: 'category-1' } })).status, 409);
  count = 0;
  assert.equal((await route.DELETE(new Request('https://shop.example.uz'), { params: { id: 'category-1' } })).status, 409);
});

test('receipt modal has a single print action and new sale action', t => {
  const before = global.document;
  global.document = { body: {} };
  t.after(() => { global.document = before; });
  const React = require('react');
  const { default: ReceiptModal } = load('src/components/pos/ReceiptModal.tsx', {
    'react-dom': { createPortal: () => null },
    '@/lib/client-api': {}, '@/lib/formatters': load('src/lib/formatters.ts'),
  });
  const receipt = { receiptNumber: 'CHK-001', shopName: 'Shop', cashierName: 'Cashier', createdAt: '2026-11-13T01:00:00Z', totalAmount: 1000, discountAmount: 0, payableAmount: 1000, paidAmount: 1000, changeAmount: 0, paymentMethod: 'CASH', items: [] };
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(ReceiptModal, { isOpen: true, onClose() {}, receipt }));
  assert.ok(html.includes('Chek chiqarish'));
  assert.ok(html.includes('Yangi savdoni boshlash'));
  assert.ok(!html.includes('ESC/POS Termal'));
  assert.ok(!html.includes('Standart Chop'));
});

test('settings tariff view embeds both plans without the public header', () => {
  const data = { user: { username: 'test.user', fullName: 'Test User', role: 'SHOP_ADMIN', hasAccess: true }, shop: { name: 'Shop', status: 'ACTIVE', planCode: 'PRO', purchaseRequests: [], checkoutOrders: [] }, plans: [{ code: 'PRO', price: 299000, enabled: true }, { code: 'MAX', price: 499000, enabled: true }] };
  let index = 0;
  const states = [data, '', null];
  const { default: AccountPlans } = load('src/components/settings/AccountPlans.tsx', {
    react: { useRef: () => ({ current: false }), useState: () => [states[index++], () => {}], useEffect() {} },
    '@/lib/client-api': {}, '@/lib/plans': load('src/lib/plans.ts'),
    '@/components/marketing/OnlineCheckout': { __esModule: true, default: () => null },
    '@/components/marketing/PublicShell': { PublicHeader: () => 'Public header', PublicFooter: () => 'Public footer' },
  });
  const html = require('react-dom/server').renderToStaticMarkup(AccountPlans({ embedded: true }));
  assert.ok(html.includes('PRO'));
  assert.ok(html.includes('MAX'));
  assert.ok(!html.includes('Public header'));
  assert.ok(!html.includes('Public footer'));
});

test('Max CSV and analysis use the same tenant and date filters', async () => {
  const { NextRequest } = require('next/server');
  let rows = [{ receiptNumber: 'CHK-001', createdAt: new Date('2026-11-13T00:00:00Z'), payableAmount: 1000, paymentMethod: 'CASH', status: 'COMPLETED' }];
  let selected;
  const db = { sale: {
    findMany: async query => { selected = query; return rows; },
    groupBy: async query => { selected = query; return [{ paymentMethod: 'CASH', _sum: { payableAmount: 1000 }, _count: { _all: 1 } }]; },
  } };
  const mocks = {
    '@/lib/prisma': { prisma: db }, '@/lib/tenant': { requireTenantContext: async () => ({ context: { shopId: 'own-shop', user: { role: 'SHOP_ADMIN' } } }) },
    '@/lib/receipt-filters': load('src/lib/receipt-filters.ts'), '@/lib/formatters': load('src/lib/formatters.ts'),
    '@/lib/platform-api': { platformError: error => { throw error; } },
  };
  const request = new NextRequest('https://shop.example.uz/api/receipts/export?from=2026-11-13&to=2026-11-13');
  const csv = load('src/app/api/receipts/export/route.ts', mocks);
  const response = await csv.GET(request);
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('CHK-001'));
  assert.ok(response.headers.get('content-type').includes('text/csv'));
  assert.equal(selected.where.shopId, 'own-shop');
  assert.equal(selected.where.createdAt.gte.toISOString(), '2026-11-12T19:00:00.000Z');
  rows = Array(10001).fill(rows[0]);
  assert.equal((await csv.GET(request)).status, 400);
  const analytics = load('src/app/api/receipts/analytics/route.ts', mocks);
  const summary = await analytics.GET(request);
  assert.deepEqual((await summary.json()).data, [{ paymentMethod: 'CASH', amount: 1000, count: 1 }]);
  assert.equal(selected.where.shopId, 'own-shop');
  assert.equal(selected.where.status, 'COMPLETED');
});

test('receipt image endpoint sends PNG with a PNG download filename', async () => {
  const { NextRequest } = require('next/server');
  const png = fs.readFileSync('/tmp/savdoza-receipt-test.png');
  const route = load('src/app/api/receipts/[token]/image/route.ts', {
    '@/lib/public-receipt': { publicReceipt: async token => token === 'valid-token' ? { receiptNumber: 'CHK-001' } : null },
    '@/lib/receipt-image': { receiptImage: async () => png },
  });
  const request = new NextRequest('https://shop.example.uz/api/receipts/valid-token/image?format=png&download=1');
  const response = await route.GET(request, { params: { token: 'valid-token' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.match(response.headers.get('content-disposition'), /attachment; filename="chek-CHK-001.png"/);
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal((await route.GET(request, { params: { token: 'invalid-token' } })).status, 404);
});

test('image download saves genuine PNG and refuses error pages or invalid images', async t => {
  const before = global.document;
  let downloads = 0;
  let filename;
  const errors = [];
  const anchor = { href: '', download: '', click() { downloads++; filename = this.download; }, remove() {} };
  global.document = { body: { appendChild() {} }, createElement: () => anchor };
  t.after(() => { global.document = before; });
  const states = [false, '', false, 0];
  let index = 0;
  const { default: PublicReceiptImage } = load('src/components/pos/PublicReceiptImage.tsx', {
    react: { useState: () => { const current = index++; return [states[current], value => { if (current === 1) errors.push(value); }]; } },
  });
  const element = PublicReceiptImage({ imageUrl: '/image?format=png', filename: 'chek-001.png', description: 'Chek' });
  const download = element.props.children[1].props.onClick;
  t.mock.method(global, 'fetch', async () => Response.json({ error: 'Unavailable' }, { status: 503 }));
  await download();
  assert.equal(downloads, 0);
  assert.ok(errors.some(error => error.includes('yuklab bo‘lmadi')));
  global.fetch = async () => new Response('<svg>old image</svg>', { headers: { 'content-type': 'image/png' } });
  await download();
  assert.equal(downloads, 0);
  assert.ok(errors.some(error => error.includes('to‘liq olinmadi')));
  global.fetch = async () => new Response(fs.readFileSync('/tmp/savdoza-receipt-test.png'), { headers: { 'content-type': 'image/png' } });
  await download();
  assert.equal(downloads, 1);
  assert.equal(filename, 'chek-001.png');
});

test('offline sale schema keeps timestamps and quoted totals while older callers still work', () => {
  const { saleSchema, debtSaleSchema } = load('src/lib/validations.ts');
  const input = { paymentMethod: 'CASH', paidAmount: 1000, items: [{ productId: 'p', batchId: 'b', quantity: 1, unitPrice: 1000 }] };
  assert.equal(saleSchema.parse(input).occurredAt, undefined);
  const occurredAt = new Date(Date.now() - 3600000).toISOString();
  assert.equal(saleSchema.parse({ ...input, occurredAt, expectedTotal: 1000 }).occurredAt, occurredAt);
  assert.equal(saleSchema.safeParse({ ...input, occurredAt: new Date(Date.now() + 3600000).toISOString() }).success, false);
  assert.equal(debtSaleSchema.parse({ ...input, firstName: 'Test', lastName: 'User', occurredAt, expectedTotal: 1000 }).expectedTotal, 1000);
});

test('offline retries reject reuse with different cart, customer or payment', () => {
  const { assertReplay } = load('src/lib/sale-replay.ts', { './prisma': { prisma: {} }, './onboarding': { BusinessError } });
  const items = [{ productId: 'p', batchId: 'b', quantity: 2, unitPrice: 1000, discount: 0 }];
  const sale = { paymentMethod: 'CASH', discountAmount: 0, paidAmount: 2000, payableAmount: 2000, customerId: null, items };
  const input = { paymentMethod: 'CASH', discountAmount: 0, paidAmount: 2000, expectedTotal: 2000, items };
  assert.doesNotThrow(() => assertReplay(sale, input));
  for (const patch of [{ paymentMethod: 'CARD' }, { customerId: 'other' }, { paidAmount: 3000 }, { expectedTotal: 3000 }, { items: [{ ...items[0], quantity: 3 }] }]) {
    assert.throws(() => assertReplay(sale, { ...input, ...patch }), /identifikatori/);
  }
});

test('refund amounts include original discount and tax and respect prior returns', () => {
  const {withRefundInfo, refundForQuantity} = load('src/lib/refunds.ts');
  const sale = withRefundInfo({payableAmount: 9001, items:[{id:'a',quantity:3,unitPrice:1000},{id:'b',quantity:1,unitPrice:7000}], returns:[]});
  const a=sale.items[0], b=sale.items[1];
  assert.equal(a.refundAllocation+b.refundAllocation,9001);
  assert.equal(refundForQuantity(a,1)+refundForQuantity({...a,returnedQuantity:1,refundedAmount:refundForQuantity(a,1)},2),a.refundAllocation);
  const returned=withRefundInfo({...sale,returns:[{items:[{saleItemId:'a',quantity:1,totalRefund:900}]}]});
  assert.equal(returned.items[0].returnableQuantity,2);
  assert.ok(refundForQuantity(returned.items[0],2)<=returned.items[0].refundAllocation-900);
});
