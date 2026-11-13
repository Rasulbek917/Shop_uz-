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
      '@/lib/validations': {}, '@/lib/audit': {}, '@/lib/logger': { logger: { error() {} } }, '@/lib/receipt': {},
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
