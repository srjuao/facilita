// Opt-in against the disposable local database only, after prisma migrate deploy.
const test = require('node:test');
const assert = require('node:assert/strict');
test('PostgreSQL: contracts, invoice snapshots, concurrent issuance and manual settlement', { skip: !process.env.FINANCE_TEST_DATABASE_URL }, async () => {
  const url = new URL(process.env.FINANCE_TEST_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55439');
  assert.equal(url.pathname, '/facilita_finance_validation');
  process.env.DATABASE_URL = url.href;
  const { financeDb: db, platformFinanceRouter: router } = require('../dist/platform-finance/router');
  const { assignPlan } = require('../dist/controllers/plan.controller');
  const suffix = require('node:crypto').randomUUID();
  const tenantId = `finance-test-${suffix}`;
  const planId = `finance-plan-${suffix}`;
  let admin;
  function request(path, method, body = {}) {
    return new Promise((resolve, reject) => {
      const layer = router.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(path));
      assert.ok(layer);
      const req = { user: { id: admin.id, role: 'superadmin' }, params: layer.params, query: {}, body };
      const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, body }); } };
      layer.route.stack[0].handle(req, res, reject);
    });
  }
  try {
    await db.plan.create({ data: { id: planId, nome: 'Local per-student validation', billingMode: 'POR_ALUNO', priceCents: 430, videoAulas: true, provas: true, ia: false } });
    await db.tenant.create({ data: { id: tenantId, nome: 'Local validation', full: '', cidade: '', color: '', cover: '', dominio: `${suffix}.invalid`, admin: '', since: '' } });
    admin = await db.user.create({ data: { nome: 'Local operator', email: `${suffix}@operator.invalid`, password: 'not-a-login-hash', papel: 'Superadmin', role: 'superadmin' } });
    await db.user.createMany({ data: Array.from({ length: 803 }, (_, i) => ({ nome: 'Local test', email: `${suffix}-${i}@test.invalid`, password: 'not-a-login-hash', papel: '', tenantId, role: i < 802 ? 'aluno' : 'professor', disabledAt: i >= 800 && i < 802 ? new Date() : null })) });
    const terms = { minimumStudents: 1000, unitCents: 430, dueDay: 10, closingDay: 1, billingName: 'Local institution', billingDocument: 'TEST ONLY', billingAddress: 'Local validation', billingEmail: 'finance@test.invalid', issuerName: 'Local issuer', issuerDocument: 'TEST ONLY', issuerAddress: 'Local validation', paymentInstructions: 'Not payable — automated test' };
    const linked = await new Promise((resolve, reject) => {
      const req = { user: { id: admin.id, role: 'superadmin' }, params: { id: tenantId }, body: { planId, expectedPlanId: null, billingContract: terms, expectedContractVersion: null } };
      const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, body }); } };
      Promise.resolve(assignPlan(req, res)).catch(reject);
    });
    assert.equal(linked.code, 200, JSON.stringify(linked.body));
    assert.equal(linked.body.billingContract.dueDay, 10);
    assert.equal(linked.body.billingContract.closingDay, 1);
    const listed = await request('/', 'GET');
    assert.equal(listed.code, 200, JSON.stringify(listed.body));
    assert.equal(listed.body.contracts.find(c => c.tenantId === tenantId).dueDay, 10);
    const emit = () => request('/invoices', 'POST', { tenantId, competence: '2026-10', expectedContractVersion: 0 });
    const concurrent = await Promise.all([emit(), emit()]);
    assert.deepEqual(concurrent.map(r => r.code).sort(), [201, 409]);
    const invoice = concurrent.find(r => r.code === 201).body.invoice;
    assert.equal(new Date(invoice.dueDate).toISOString().slice(0, 10), '2026-10-10');
    assert.equal(invoice.totalCents, 430000);
    assert.equal(invoice.activeStudents, 800);
    assert.equal(invoice.billableStudents, 1000);
    assert.equal(invoice.events.length, 1);
    await db.user.createMany({ data: Array.from({ length: 300 }, (_, i) => ({ nome: 'Local excess', email: `${suffix}-excess-${i}@test.invalid`, password: 'not-a-login-hash', papel: '', tenantId, role: 'aluno' })) });
    const extra = await request('/invoices', 'POST', { tenantId, competence: '2026-09', expectedContractVersion: 0 });
    assert.equal(extra.code, 201, JSON.stringify(extra.body));
    assert.equal(extra.body.invoice.totalCents, 473000);
    assert.equal((await request(`/contracts/${tenantId}`, 'PUT', { ...terms, unitCents: 500, expectedVersion: 0 })).code, 200);
    const snapshot = await db.platformInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(snapshot.unitCents, 430);
    assert.equal(snapshot.totalCents, 430000);
    const settled = await request(`/invoices/${invoice.id}/status`, 'PATCH', { status: 'PAID', note: 'Local test reference', expectedVersion: 0 });
    assert.equal(settled.code, 200, JSON.stringify(settled.body));
    assert.equal(settled.body.invoice.events.length, 2);
    assert.equal((await request(`/invoices/${invoice.id}/status`, 'PATCH', { status: 'PAID', note: 'Repeat blocked', expectedVersion: 0 })).code, 409);
    const listing = await request('/', 'GET');
    assert.equal(listing.code, 200, JSON.stringify(listing.body));
    assert.equal(listing.body.contracts.find(c => c.tenantId === tenantId).activeStudents, 1100);
    await db.user.update({ where: { id: admin.id }, data: { disabledAt: new Date() } });
    assert.equal((await request('/', 'GET')).code, 403);
  } finally { await db.$disconnect(); }
});
