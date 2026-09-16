/* eslint-disable @typescript-eslint/no-require-imports */
// Runs against a fresh temporary SQLite file only. No live products or images are changed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'grocery-billing-test-'));
const database = path.join(directory, 'test.db');
const db = new PrismaClient({ datasources: { db: { url: `file:${database.replaceAll('\\', '/')}` } } });
global.prisma = db;
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(result.outputText, filename);
};
const { POST: checkout } = require('../src/app/api/sales/route.ts');
const productApi = require('../src/app/api/products/route.ts');
const singleApi = require('../src/app/api/products/[id]/route.ts');
const barcodeApi = require('../src/app/api/products/by-barcode/[barcode]/route.ts');

async function migrate(name) {
  const sql = fs.readFileSync(path.join(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');
  for (const statement of sql.split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
}
before(async () => {
  await migrate('20260913163825_init');
  await migrate('20260914190000_product_pricing');
  await db.$executeRawUnsafe(`INSERT INTO Product (id, name, category, price, pricingAmount, unit, quantity, image, barcode, createdAt, updatedAt) VALUES (1, 'Existing product', 'Existing category', 123.45, 100, 'g', 5000, '/existing.jpg', '00001', 1700000000000, 1700000000001)`);
  await db.$executeRawUnsafe("UPDATE sqlite_sequence SET seq = 100 WHERE name = 'Product'");
  await migrate('20260916140000_billing_foundation');
});
after(async () => {
  await db.$disconnect();
  Module._resolveFilename = originalResolve;
  for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file));
  fs.rmdirSync(directory);
});
function request(body) { return new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
function context(id) { return { params: Promise.resolve({ id: String(id) }) }; }
async function product(overrides = {}) {
  return db.product.create({ data: { name: 'Test product', category: 'Test', price: '400', pricingAmount: '1', unit: 'Pcs', quantity: '10', ...overrides } });
}
async function sale(p, quantity, options = {}) {
  const response = await checkout(request({ requestId: randomUUID(), items: [{ productId: p.id, quantity }], paymentMethod: 'CARD', ...options }));
  return { status: response.status, body: await response.json() };
}
async function stock(id) { return (await db.product.findUniqueOrThrow({ where: { id } })).quantity.toFixed(); }

test('migration preserves every existing field, timestamps and ID sequence', async () => {
  const p = await db.product.findUniqueOrThrow({ where: { id: 1 } });
  assert.equal(p.name, 'Existing product'); assert.equal(p.category, 'Existing category');
  assert.equal(p.price.toFixed(), '123.45'); assert.equal(p.pricingAmount.toFixed(), '100');
  assert.equal(p.quantity.toFixed(), '5000'); assert.equal(p.unit, 'g');
  assert.equal(p.image, '/existing.jpg'); assert.equal(p.barcode, '00001');
  assert.equal(p.createdAt.getTime(), 1700000000000); assert.equal(p.updatedAt.getTime(), 1700000000001);
  assert.equal(p.version, 0); assert.ok((await product()).id > 100);
});
test('cash sale, discount, change and two-decimal JSON', async () => {
  const p = await product({ name: 'Cashews', unit: 'g', pricingAmount: '100', price: '700', quantity: '5000' });
  const result = await sale(p, '250', { discount: '50', paymentMethod: 'CASH', amountTendered: '2000' });
  assert.equal(result.status, 201); assert.equal(result.body.replayed, false);
  assert.equal(result.body.sale.subtotal, '1750.00'); assert.equal(result.body.sale.total, '1700.00');
  assert.equal(result.body.sale.changeDue, '300.00'); assert.equal(result.body.sale.items[0].unitPrice, '700.00');
  assert.equal(await stock(p.id), '4750');
});
test('card and whole-piece sale; client price is ignored', async () => {
  const p = await product();
  const response = await checkout(request({ requestId: randomUUID(), items: [{ productId: p.id, quantity: 2, price: 1 }], paymentMethod: 'CARD', total: 1 }));
  const { sale: s } = await response.json();
  assert.equal(response.status, 201); assert.equal(s.total, '800.00');
  assert.equal(s.amountTendered, null); assert.equal(s.changeDue, null); assert.equal(await stock(p.id), '8');
});
test('decimal sales for all continuous units and exact repeated subtraction', async () => {
  for (const unit of ['g', 'Kg', 'ml', 'Ltr']) {
    const p = await product({ unit, quantity: '0.3', price: '0.10' });
    for (let i = 0; i < 3; i++) assert.equal((await sale(p, '0.1')).status, 201);
    assert.equal(await stock(p.id), '0');
  }
});
test('fractional quantities rejected for every discrete unit, even duplicate half-lines', async () => {
  for (const unit of ['Pcs', 'Pkt', 'Bottle']) {
    const p = await product({ unit });
    assert.equal((await sale(p, '0.5')).body.code, 'WHOLE_QUANTITY_REQUIRED');
    const response = await checkout(request({ requestId: randomUUID(), items: [{ productId: p.id, quantity: '0.5' }, { productId: p.id, quantity: '0.5' }], paymentMethod: 'CARD' }));
    assert.equal(response.status, 400); assert.equal(await stock(p.id), '10');
  }
});
test('half-up rounding per combined product line', async () => {
  const p = await product({ unit: 'g', price: '0.01', pricingAmount: '2' });
  const result = await sale(p, '1'); assert.equal(result.body.sale.total, '0.01');
});
test('invalid cash/discount and insufficient stock leave no deduction or sale', async () => {
  const p = await product();
  const count = await db.sale.count();
  assert.equal((await sale(p, 11)).body.code, 'INSUFFICIENT_STOCK');
  assert.equal((await sale(p, 1, { paymentMethod: 'CASH', amountTendered: 399 })).body.code, 'INSUFFICIENT_CASH');
  assert.equal((await sale(p, 1, { discount: 401 })).body.code, 'INVALID_DISCOUNT');
  assert.equal((await sale(p, 1, { discount: -1 })).status, 400);
  assert.equal((await sale(p, 1, { paymentMethod: 'CASH' })).status, 400);
  assert.equal(await stock(p.id), '10'); assert.equal(await db.sale.count(), count);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).version, 0);
});
test('a later failing line rolls back an earlier stock write', async () => {
  const first = await product(); const second = await product({ quantity: '0' });
  const response = await checkout(request({ requestId: randomUUID(), items: [{ productId: first.id, quantity: 1 }, { productId: second.id, quantity: 1 }], paymentMethod: 'CARD' }));
  assert.equal(response.status, 409); assert.equal(await stock(first.id), '10');
});
test('duplicate product lines combined and cannot oversell', async () => {
  const p = await product({ quantity: '1' });
  const response = await checkout(request({ requestId: randomUUID(), items: [{ productId: p.id, quantity: 1 }, { productId: p.id, quantity: 1 }], paymentMethod: 'CARD' }));
  assert.equal(response.status, 409); assert.equal(await stock(p.id), '1');
});
test('same request ID replays the stored sale without deducting again', async () => {
  const p = await product(); const requestId = randomUUID();
  const first = await sale(p, 1, { requestId }); const repeat = await sale(p, 1, { requestId });
  assert.equal(first.status, 201); assert.equal(repeat.status, 200); assert.equal(repeat.body.replayed, true);
  assert.deepEqual(repeat.body.sale, first.body.sale); assert.equal(await stock(p.id), '9');
});
test('concurrent duplicate requests produce one sale and one deduction', async () => {
  const p = await product(); const requestId = randomUUID();
  const results = await Promise.all([sale(p, 1, { requestId }), sale(p, 1, { requestId })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 201]);
  assert.equal(await db.sale.count({ where: { requestId } }), 1); assert.equal(await stock(p.id), '9');
});
test('two requests competing for final stock cannot both succeed', async () => {
  const p = await product({ quantity: '1' });
  const results = await Promise.all([sale(p, 1), sale(p, 1)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]); assert.equal(await stock(p.id), '0');
});
test('product edit version rejects stale form after sale and skips unchanged image', async () => {
  const p = await product({ image: '/api/product-images/missing photo.jpg' });
  assert.equal((await sale(p, 1)).status, 201);
  const stale = await singleApi.PATCH(request({ version: p.version, quantity: '10' }), context(p.id));
  assert.equal(stale.status, 409); assert.equal(await stock(p.id), '9');
  const current = await singleApi.PATCH(request({ version: 1, quantity: '8' }), context(p.id));
  assert.equal(current.status, 200); assert.equal((await current.json()).version, 2);
});
test('two simultaneous edits using the same version cannot overwrite each other', async () => {
  const p = await product();
  const results = await Promise.all([singleApi.PATCH(request({ version: 0, quantity: '7' }), context(p.id)), singleApi.PATCH(request({ version: 0, quantity: '6' }), context(p.id))]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});
test('sale snapshots survive product editing and deletion', async () => {
  const p = await product({ name: 'Original', barcode: '000987' }); const requestId = randomUUID();
  const original = (await sale(p, 1, { requestId })).body.sale;
  const edit = await singleApi.PATCH(request({ version: 1, name: 'Renamed', price: '900' }), context(p.id)); assert.equal(edit.status, 200);
  assert.equal((await sale(p, 1, { requestId })).body.sale.items[0].productName, 'Original');
  assert.equal((await singleApi.DELETE(request({}), context(p.id))).status, 200);
  const replay = (await sale(p, 1, { requestId })).body.sale;
  assert.deepEqual(replay.items[0], { ...original.items[0], productId: null });
  assert.equal(replay.total, original.total);
});
test('product API decimal JSON, partial edits, validation and exact leading-zero barcode', async () => {
  const response = await productApi.POST(request({ name: 'Liquid', category: 'Test', price: '12.50', pricingAmount: '0.5', quantity: '25.125', unit: 'Ltr', barcode: '000000123' }));
  assert.equal(response.status, 201); const p = await response.json();
  assert.equal(p.price, '12.50'); assert.equal(p.quantity, '25.125'); assert.equal(p.version, 0);
  const result = await barcodeApi.GET(request({}), { params: Promise.resolve({ barcode: '000000123' }) });
  assert.deepEqual(await result.json(), p);
  assert.equal((await barcodeApi.GET(request({}), { params: Promise.resolve({ barcode: '123' }) })).status, 404);
  assert.equal((await singleApi.PATCH(request({ price: '13.50' }), context(p.id))).status, 400);
  assert.equal((await singleApi.PATCH(request({ version: 0, unit: 'Bottle' }), context(p.id))).status, 400);
  assert.equal((await singleApi.PATCH(request({ version: 0, price: '13.50' }), context(p.id))).status, 200);
  const list = await (await productApi.GET()).json(); assert.ok(list.every(p => typeof p.price === 'string' && typeof p.quantity === 'string'));
});
test('invalid sale inputs, missing product and precision limits', async () => {
  const p = await product();
  for (const quantity of [0, -1, 'NaN', null, '0.0001', '1000000000']) assert.equal((await sale(p, quantity)).status, 400);
  assert.equal((await sale(p, 1, { paymentMethod: 'CHEQUE' })).status, 400);
  assert.equal((await sale({ id: 2147483647 }, 1)).status, 404);
  for (const body of [{}, { requestId: 'x', items: [] }, { requestId: 'x', items: [{ productId: '1', quantity: 1 }] }]) assert.equal((await checkout(request(body))).status, 400);
  assert.equal((await checkout(new Request('http://localhost/api/sales', { method: 'POST', body: '{' }))).status, 400);
});
