const test = require('node:test');
const assert = require('node:assert/strict');
const { billingAmount, dueDate } = require('../dist/platform-finance/policy');
const { financeDb: db, platformFinanceRouter: router } = require('../dist/platform-finance/router');
let account = { id: 'admin', nome: 'Admin', role: 'superadmin', disabledAt: null, tenantId: null };
const contract = { tenantId: 'tenant-a', minimumStudents: 1000, unitCents: 430, dueDay: 10, billingName: 'Institution', billingDocument: 'Document', billingAddress: 'Address', billingEmail: 'finance@example.invalid', issuerName: 'Facilita', issuerDocument: 'Issuer document', issuerAddress: 'Issuer address', paymentInstructions: '', version: 0, updatedBy: 'admin', createdAt: new Date(), updatedAt: new Date() };
const tx = { $queryRaw: async () => [], user: { findUnique: async () => account, count: async ({ where }) => { assert.deepEqual(where, { tenantId: 'tenant-a', role: 'aluno', disabledAt: null }); return 1100; } }, tenant: { findUnique: async () => ({ id: 'tenant-a', ativo: true }) }, platformContract: { findUnique: async () => contract }, platformInvoice: { findUnique: async () => null, create: async ({ data }) => ({ id: 'invoice', ...data }) } };
db.user.findUnique = async () => account;
db.$transaction = async callback => callback(tx);
function request(path, method, body = {}) {
  return new Promise((resolve, reject) => {
    const layer = router.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(path));
    assert.ok(layer);
    const req = { user: { id: 'admin', role: 'superadmin' }, params: layer.params, query: {}, body };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, body }); } };
    layer.route.stack[0].handle(req, res, reject);
  });
}
test('contract minimum floors billing and excess is exact cents, never staff counts', () => {
  assert.deepEqual(billingAmount(1000, 800, 430), { billableStudents: 1000, totalCents: 430000 });
  assert.deepEqual(billingAmount(1000, 1000, 430), { billableStudents: 1000, totalCents: 430000 });
  assert.deepEqual(billingAmount(1000, 1100, 430), { billableStudents: 1100, totalCents: 473000 });
  for (const args of [[0, 1, 430], [1, -1, 430], [1, 1, 4.3], [2147483647, 1, 2]]) assert.throws(() => billingAmount(...args));
});
test('competence date is exact UTC and rejects invalid months and day', () => {
  assert.equal(dueDate('2026-02', 28).toISOString(), '2026-02-28T00:00:00.000Z');
  for (const value of ['2026-13', '2026-00', '2026-2', '<script>']) assert.throws(() => dueDate(value, 10));
  assert.throws(() => dueDate('2026-02', 31));
});
test('current role and disabled account override forged token role', async () => {
  for (const role of ['coord', 'staff', 'professor', 'aluno']) {
    account = { ...account, role };
    assert.equal((await request('/invoices', 'POST')).code, 403);
  }
  account = { ...account, role: 'superadmin', disabledAt: new Date() };
  assert.equal((await request('/invoices', 'POST')).code, 403);
  account = { ...account, disabledAt: null };
});
test('invoice snapshots server contract and counts, ignores forged totals', async () => {
  const result = await request('/invoices', 'POST', { tenantId: 'tenant-a', competence: '2026-10', expectedContractVersion: 0, totalCents: 1, unitCents: 1, activeStudents: 0, billingName: 'Forged' });
  assert.equal(result.code, 201);
  assert.equal(result.body.invoice.totalCents, 473000);
  assert.equal(result.body.invoice.unitCents, 430);
  assert.equal(result.body.invoice.billingName, 'Institution');
  assert.equal(result.body.invoice.events.create.actorId, 'admin');
  assert.equal(result.body.invoice.contractVersion, 0);
});
test('global superadmin can read and issue despite an inactive legacy institution link', async () => {
  const previous = account;
  account = { ...account, tenantId: 'legacy-inactive', tenant: { ativo: false } };
  db.platformContract.findMany = async () => [];
  db.user.groupBy = async () => [];
  db.platformInvoice.findMany = async () => [];
  try {
    assert.equal((await request('/', 'GET')).code, 200);
    assert.equal((await request('/invoices', 'POST', { tenantId: 'tenant-a', competence: '2026-10', expectedContractVersion: 0 })).code, 201);
    account = { ...account, disabledAt: new Date() };
    assert.equal((await request('/', 'GET')).code, 403);
  } finally { account = previous; }
});
test('duplicate competency stays forbidden after cancellation and changed contract conflicts', async () => {
  assert.equal((await request('/invoices', 'POST', { tenantId: 'tenant-a', competence: '2026-10', expectedContractVersion: 1 })).code, 409);
  tx.platformInvoice.findUnique = async () => ({ id: 'invoice', status: 'CANCELLED' });
  assert.equal((await request('/invoices', 'POST', { tenantId: 'tenant-a', competence: '2026-10', expectedContractVersion: 0 })).code, 409);
  tx.platformInvoice.findUnique = async () => null;
});
test('contract updates require correct expected version and cannot alter historical invoices', async () => {
  assert.equal((await request('/contracts/tenant-a', 'PUT', { ...contract, expectedVersion: null })).code, 409);
  let updated;
  tx.platformContract.update = async ({ data }) => { updated = data; return data; };
  const result = await request('/contracts/tenant-a', 'PUT', { ...contract, unitCents: 500, expectedVersion: 0 });
  assert.equal(result.code, 200); assert.equal(updated.unitCents, 500); assert.deepEqual(updated.version, { increment: 1 });
  assert.equal(updated.tenantId, undefined);
});
test('manual settlement is audited, cannot settle cancelled or stale invoices', async () => {
  tx.platformInvoice.findUnique = async () => ({ id: 'invoice', status: 'OPEN', version: 0 });
  tx.platformInvoice.update = async ({ data }) => data;
  assert.equal((await request('/invoices/invoice/status', 'PATCH', { status: 'PAID', note: '', expectedVersion: 0 })).code, 400);
  assert.equal((await request('/invoices/invoice/status', 'PATCH', { status: 'PAID', note: 'Receipt 123', expectedVersion: 1 })).code, 409);
  const result = await request('/invoices/invoice/status', 'PATCH', { status: 'PAID', note: 'Receipt 123', expectedVersion: 0 });
  assert.equal(result.code, 200); assert.equal(result.body.invoice.events.create.note, 'Receipt 123'); assert.ok(result.body.invoice.paidAt);
  tx.platformInvoice.findUnique = async () => ({ id: 'invoice', status: 'CANCELLED', version: 0 });
  assert.equal((await request('/invoices/invoice/status', 'PATCH', { status: 'PAID', note: 'Receipt 123', expectedVersion: 0 })).code, 409);
});
test('mutation rechecks actor inside locked transaction and inactive tenant denies issuance', async () => {
  tx.user.findUnique = async () => ({ ...account, role: 'coord' });
  assert.equal((await request('/invoices', 'POST', { tenantId: 'tenant-a', competence: '2026-10', expectedContractVersion: 0 })).code, 403);
  tx.user.findUnique = async () => account;
  tx.tenant.findUnique = async () => ({ id: 'tenant-a', ativo: false });
  assert.equal((await request('/invoices', 'POST', { tenantId: 'tenant-a', competence: '2026-10', expectedContractVersion: 0 })).code, 409);
});
