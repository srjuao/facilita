const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { validatePlan, estimatedCents, assertCapacity } = require('../dist/controllers/plan-policy');
const valid = { nome: ' Básico ', descricao: '', billingMode: 'POR_ALUNO', priceCents: 430, studentLimit: 20, videoAulas: true, provas: false, ia: false };
test('plan validates explicit booleans, integer cents and bounds; ignores caller identities/status', () => {
  assert.deepEqual(validatePlan({ ...valid, id: 'override', ativo: false }), { ...valid, nome: 'Básico' });
  for (const patch of [{ nome: '' }, { nome: 'x'.repeat(101) }, { descricao: null }, { descricao: 'x'.repeat(1001) }, { billingMode: 'year' }, { priceCents: -1 }, { priceCents: 1.2 }, { priceCents: '430' }, { priceCents: 100000001 }, { studentLimit: 0 }, { studentLimit: 1.1 }, { studentLimit: undefined }, { videoAulas: 'true' }, { provas: undefined }, { ia: 1 }]) assert.throws(() => validatePlan({ ...valid, ...patch }));
  assert.equal(validatePlan({ ...valid, studentLimit: null }).studentLimit, null);
});
test('estimates monthly costs without rounding floats or mistaking an unconfigured plan for free', () => {
  assert.equal(estimatedCents(null, 10), null);
  assert.equal(estimatedCents(valid, 3), 1290);
  assert.equal(estimatedCents({ ...valid, billingMode: 'FIXO' }, 0), 430);
  assert.equal(estimatedCents(valid, 0), 0);
  assert.equal(estimatedCents({ ...valid, priceCents: 100000000 }, 1000000), 100000000000000);
});
test('capacity rejects exceeded bindings and new students but permits exact-limit and unlimited plans', () => {
  assert.throws(() => assertCapacity(20, 20), /limite/);
  assert.throws(() => assertCapacity(20, 21, 0), /limite/);
  assert.doesNotThrow(() => assertCapacity(20, 20, 0));
  assert.doesNotThrow(() => assertCapacity(null, 1000000));
});

let tenant = { id: 'tenant', nome: 'Escola', ativo: true, planId: null, plan: null };
let plan = { id: 'plan', ...valid, ativo: true };
let academic = 2, unassigned = 1, events = [], saves = 0;
let account = { id: 'user', email: 'u@example.test', role: 'aluno', tenantId: 'tenant', courseId: 'new-course', studentId: 4, tenant };
const db = {
  $queryRaw: async (sql, id) => { events.push(sql[0].includes('Tenant') ? 'lock-tenant' : 'lock-plan'); return id === 'missing' ? [] : [{ id }]; },
  tenant: {
    findUniqueOrThrow: async () => ({ ...tenant, plan: tenant.planId ? plan : null }),
    update: async ({ data }) => { saves++; tenant = { ...tenant, planId: data.planId, plan: data.planId ? plan : null }; return { ...tenant, courses: [{ _count: { students: academic } }], _count: { users: unassigned } }; },
    findMany: async () => [{ ...tenant, plan: tenant.planId ? plan : null, courses: [{ _count: { students: academic } }], _count: { users: unassigned } }]
  },
  plan: { findUniqueOrThrow: async () => plan, create: async ({ data }) => { saves++; return { id: 'created', ...data }; } },
  student: { count: async () => { events.push('count-students'); return academic; } },
  user: { count: async args => { assert.equal(args.where.studentId, null); assert.equal(args.where.role, 'aluno'); return unassigned; }, findUnique: async () => account },
  $transaction: async fn => fn(db)
};
const originalLoad = Module._load;
let controllers, access;
try {
  Module._load = function (name, ...args) { if (name === '@prisma/client') return { PrismaClient: class { constructor() { return db; } } }; return originalLoad.call(this, name, ...args); };
  controllers = require('../dist/controllers/plan.controller');
  access = require('../dist/controllers/plan-access');
} finally { Module._load = originalLoad; }
const response = () => ({ code: 200, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } });
const req = body => ({ user: { id: 'admin', role: 'superadmin' }, params: { id: 'tenant' }, body });
test('plan controllers deny tenant users before touching writes', async () => {
  const before = saves;
  for (const handler of [controllers.createPlan, controllers.assignPlan, controllers.getPlans, controllers.getSubscriptions, controllers.updatePlanStatus]) { const r = response(); await handler({ ...req(valid), user: { role: 'coord' } }, r); assert.equal(r.code, 403); }
  assert.equal(saves, before);
});
test('assignment locks tenant before count, counts unassigned accounts, and estimates from actual records', async () => {
  events = []; const r = response();
  await controllers.assignPlan(req({ planId: 'plan', expectedPlanId: null }), r);
  assert.equal(r.code, 200); assert.equal(r.body.studentCount, 3); assert.equal(r.body.estimatedCents, 1290);
  assert.equal(events[0], 'lock-tenant'); assert.ok(events.indexOf('lock-plan') < events.indexOf('count-students'));
});
test('assignment rejects stale expected plan, inactive new plan, invalid body and insufficient limit', async () => {
  tenant.planId = null; plan.ativo = false;
  for (const [body, status] of [[{ planId: 'plan', expectedPlanId: 'old' }, 409], [{ planId: 'plan', expectedPlanId: null }, 409], [{ planId: 'plan' }, 400], [{ planId: 'missing', expectedPlanId: null }, 404]]) { const r = response(); await controllers.assignPlan(req(body), r); assert.equal(r.code, status); }
  plan.ativo = true; plan.studentLimit = 2;
  const r = response(); await controllers.assignPlan(req({ planId: 'plan', expectedPlanId: null }), r); assert.equal(r.code, 409);
  plan.studentLimit = 20;
});
test('removing plan restores unconfigured/null billing, not a zero-value invoice', async () => {
  tenant.planId = 'plan'; const r = response(); await controllers.assignPlan(req({ planId: null, expectedPlanId: 'plan' }), r);
  assert.equal(r.code, 200); assert.equal(r.body.plan, null); assert.equal(r.body.estimatedCents, null);
});
test('capacity helper serializes writes and counts studentless student accounts', async () => {
  tenant.planId = 'plan'; plan.studentLimit = 3; events = [];
  await assert.rejects(access.enforceStudentCapacity(db, 'tenant'), /limite/);
  assert.equal(events[0], 'lock-tenant');
  plan.studentLimit = 20;
});
test('resource gates re-read plan and refresh stale token assignments; inactive plans retain entitlements', async () => {
  account.tenant = { ...tenant, plan }; plan.ativo = false;
  const request = { user: { id: 'user', role: 'aluno', courseId: 'old-course' } };
  await assert.rejects(access.requireFeature(request, 'provas'), /não está incluído/);
  assert.equal(request.user.courseId, 'new-course');
  await access.requireFeature(request, 'videoAulas');
  account.tenant.plan = null; await access.requireFeature(request, 'ia');
  account.tenant.ativo = false; await assert.rejects(access.requireFeature(request, 'ia'), /não está ativa/);
  account.tenant.ativo = true; plan.ativo = true;
});
test('AI send is explicitly unavailable without writing fabricated answers or submitted messages', async () => {
  const { sendMessage } = require('../dist/controllers/chat.controller');
  const r = response(); await sendMessage({ user: { studentId: 4 }, body: { content: '<script>test</script>' } }, r);
  assert.equal(r.code, 503); assert.match(r.body.error, /Nenhuma mensagem foi enviada/);
});
