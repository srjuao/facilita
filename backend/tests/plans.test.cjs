const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { validatePlan, estimatedCents, assertCapacity } = require('../dist/controllers/plan-policy');
const valid = { nome: ' Básico ', descricao: '', billingMode: 'POR_ALUNO', priceCents: 430, studentLimit: 20, defaultMinimumStudents: null, videoAulas: true, provas: false, ia: false };
test('plan validates explicit booleans, integer cents and bounds; ignores caller identities/status', () => {
  assert.deepEqual(validatePlan({ ...valid, id: 'override', ativo: false }), { ...valid, nome: 'Básico' });
  for (const patch of [{ nome: '' }, { nome: 'x'.repeat(101) }, { descricao: null }, { descricao: 'x'.repeat(1001) }, { billingMode: 'year' }, { priceCents: -1 }, { priceCents: 1.2 }, { priceCents: '430' }, { priceCents: 100000001 }, { studentLimit: 0 }, { studentLimit: 1.1 }, { studentLimit: undefined }, { defaultMinimumStudents: 0 }, { defaultMinimumStudents: 21 }, { defaultMinimumStudents: 1.1 }, { videoAulas: 'true' }, { provas: undefined }, { ia: 1 }]) assert.throws(() => validatePlan({ ...valid, ...patch }));
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
let adminAccount = { id: 'admin', role: 'superadmin', disabledAt: null };
let billingContract = null;
const terms = { minimumStudents: 10, unitCents: 430, dueDay: 10, closingDay: 1, billingName: 'Escola', billingDocument: '123', billingAddress: 'Rua Teste', billingEmail: 'finance@example.test', issuerName: 'Facilita', issuerDocument: '456', issuerAddress: 'Rua Emitente', paymentInstructions: '' };
const assignment = (planId = 'plan', expectedPlanId = null) => ({ planId, expectedPlanId, billingContract: terms, expectedContractVersion: billingContract?.version ?? null });
const db = {
  $queryRaw: async (sql, id) => { events.push(sql[0].includes('Tenant') ? 'lock-tenant' : sql[0].includes('User') ? 'lock-user' : 'lock-plan'); return id === 'missing' ? [] : [{ id }]; },
  tenant: {
    findUniqueOrThrow: async () => ({ ...tenant, plan: tenant.planId ? plan : null }),
    update: async ({ data }) => { saves++; tenant = { ...tenant, planId: data.planId, plan: data.planId ? plan : null }; return { ...tenant, billingContract, courses: [{ _count: { students: academic } }], _count: { users: unassigned } }; },
    findMany: async () => [{ ...tenant, billingContract, plan: tenant.planId ? plan : null, courses: [{ _count: { students: academic } }], _count: { users: unassigned } }]
  },
  plan: { findUniqueOrThrow: async () => plan, create: async ({ data }) => { saves++; return { id: 'created', ...data }; } },
  student: { count: async () => { events.push('count-students'); return academic; } },
  user: { count: async args => { assert.equal(args.where.role, 'aluno'); return args.where.disabledAt === null ? 2 : unassigned; }, groupBy: async () => [{ tenantId: 'tenant', _count: { id: 2 } }], findUnique: async ({ where }) => where.id === 'admin' ? adminAccount : account },
  platformContract: { findUnique: async () => billingContract, create: async ({ data }) => { saves++; billingContract = { ...data, version: 0 }; return billingContract; }, update: async ({ data }) => { saves++; billingContract = { ...billingContract, ...data, version: billingContract.version + 1 }; return billingContract; } },
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
  await controllers.assignPlan(req(assignment()), r);
  assert.equal(r.code, 200); assert.equal(r.body.studentCount, 3); assert.equal(r.body.estimatedCents, 1290);
  assert.equal(r.body.billingContract.dueDay, 10); assert.equal(r.body.contractEstimatedCents, 4300); assert.equal(r.body.activeStudentAccounts, 2);
  assert.equal(events[0], 'lock-user'); assert.ok(events.indexOf('lock-plan') < events.indexOf('count-students'));
});
test('assignment rejects stale expected plan, inactive new plan, invalid body and insufficient limit', async () => {
  tenant.planId = null; plan.ativo = false;
  for (const [body, status] of [[assignment('plan', 'old'), 409], [assignment(), 409], [{ planId: 'plan' }, 400], [assignment('missing'), 404]]) { const r = response(); await controllers.assignPlan(req(body), r); assert.equal(r.code, status); }
  plan.ativo = true; plan.studentLimit = 2;
  const r = response(); await controllers.assignPlan(req({ ...assignment(), billingContract: { ...terms, minimumStudents: 1 } }), r); assert.equal(r.code, 409);
  plan.studentLimit = 5;
  const minimumTooLarge = response(); await controllers.assignPlan(req(assignment()), minimumTooLarge); assert.equal(minimumTooLarge.code, 400);
  plan.studentLimit = 20;
});
test('plan assignment requires complete payment terms and a live superadmin; rejects stale contract updates', async () => {
  tenant.planId = null; plan.ativo = true;
  const before = saves;
  for (const body of [
    { planId: 'plan', expectedPlanId: null },
    { ...assignment(), billingContract: { ...terms, dueDay: 31 } },
    { ...assignment(), expectedContractVersion: null },
  ]) {
    const r = response(); await controllers.assignPlan(req(body), r);
    assert.equal(r.code, body.billingContract?.dueDay === 31 || !body.billingContract ? 400 : 409);
  }
  adminAccount.disabledAt = new Date();
  const forbidden = response(); await controllers.assignPlan(req(assignment()), forbidden);
  assert.equal(forbidden.code, 403);
  adminAccount.disabledAt = null;
  assert.equal(saves, before);
});
test('contract estimate counts active student accounts while plan capacity includes academic records', async () => {
  tenant.planId = 'plan';
  const r = response(); await controllers.getSubscriptions(req({}), r);
  assert.equal(r.code, 200);
  assert.equal(r.body[0].studentCount, 3);
  assert.equal(r.body[0].activeStudentAccounts, 2);
  assert.equal(r.body[0].contractEstimatedCents, billingContract ? Math.max(billingContract.minimumStudents, 2) * billingContract.unitCents : null);
  const saved = billingContract;
  billingContract = { ...saved, unitCents: 300000000 };
  const overflow = response(); await controllers.getSubscriptions(req({}), overflow);
  assert.equal(overflow.code, 200); assert.equal(overflow.body[0].contractEstimatedCents, null);
  billingContract = saved;
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

const pricePoints = [{ students: 20, unitCents: 5790 }, { students: 50, unitCents: 3490 }, { students: 100, unitCents: 2290 }, { students: 250, unitCents: 1290 }, { students: 500, unitCents: 790 }, { students: 1000, unitCents: 430 }];
test('tiered plans validate all references and store nested price records, without trusting arbitrary fields', () => {
  const input = { ...valid, billingMode: 'FAIXAS', priceCents: 0, studentLimit: null, pricePoints };
  assert.deepEqual(validatePlan(input).pricePoints, { create: pricePoints });
  for (const patch of [
    { priceCents: 1 }, { studentLimit: 10 }, { pricePoints: undefined }, { pricePoints: [] }, { pricePoints: [pricePoints[0]] },
    { pricePoints: [pricePoints[1], pricePoints[0]] }, { pricePoints: [pricePoints[0], pricePoints[0]] },
    { pricePoints: [{ students: 20, unitCents: 100 }, { students: 30, unitCents: 101 }] },
    { pricePoints: [{ students: 20, unitCents: 100 }, { students: 30, unitCents: 1 }] },
    { pricePoints: [{ students: 1.5, unitCents: 100 }, pricePoints[1]] },
    { pricePoints: [{ students: 1, unitCents: -1 }, pricePoints[1]] },
    { pricePoints: Array(21).fill(pricePoints[0]) }
  ]) assert.throws(() => validatePlan({ ...input, ...patch }));
});
test('tier estimates match anchors, interpolate totals gradually and never drop total for an extra student', () => {
  const tier = { billingMode: 'FAIXAS', priceCents: 0, pricePoints };
  assert.equal(estimatedCents(tier, 0), 0);
  assert.equal(estimatedCents(tier, 1), 5790);
  for (const point of pricePoints) assert.equal(estimatedCents(tier, point.students), point.students * point.unitCents);
  assert.equal(estimatedCents(tier, 35), 145150);
  assert.equal(estimatedCents(tier, 20000), 8600000);
  for (let n = 1; n <= 100000; n++) assert.ok(estimatedCents(tier, n) >= estimatedCents(tier, n - 1));
  assert.equal(estimatedCents({ billingMode: 'FAIXAS', priceCents: 0 }, 30), null);
  assert.equal(estimatedCents({ ...tier, pricePoints: [{ students: 10, unitCents: 1000 }, { students: 20, unitCents: 800 }] }, 15), 13000);
  assert.equal(estimatedCents({ ...tier, pricePoints: [{ students: 41, unitCents: 50685 }, { students: 697, unitCents: 30966 }] }, 497), 15636590);
});
let publicSetting = { id: 1, planId: 'plan' };
db.publicPricingSetting = {
  findUnique: async () => ({ ...publicSetting, plan }),
  findFirst: async ({ where }) => publicSetting.planId === where.planId ? publicSetting : null,
  update: async ({ data }) => { publicSetting = { ...publicSetting, ...data }; return publicSetting; }
};
db.plan.findUnique = async ({ where }) => where.id === plan.id ? plan : null;
db.plan.update = async ({ data }) => { plan = { ...plan, ...data }; return plan; };
test('public pricing exposes only chosen active unlimited tiers and returns unavailable instead of hardcoded fallback', async () => {
  plan = { id: 'plan', ...valid, ativo: true, billingMode: 'FAIXAS', priceCents: 0, studentLimit: null, pricePoints };
  const r = response(); r.setHeader = () => {};
  await controllers.getPublicPricing({}, r);
  assert.equal(r.code, 200); assert.deepEqual(Object.keys(r.body), ['planId', 'nome', 'pricePoints', 'studentLimit']);
  for (const patch of [{ ativo: false }, { studentLimit: 20 }, { billingMode: 'POR_ALUNO' }, { pricePoints: [] }]) {
    const before = plan; plan = { ...plan, ...patch }; const r = response(); r.setHeader = () => {};
    await controllers.getPublicPricing({}, r); assert.equal(r.code, 503); plan = before;
  }
});
test('public pricing selection is superadmin-only, optimistic and rejects inactive or capped plans', async () => {
  for (const handler of [controllers.getPricingSetting, controllers.updatePricingSetting]) {
    const r = response(); await handler({ ...req({}), user: { role: 'coord' } }, r); assert.equal(r.code, 403);
  }
  const stale = response(); await controllers.updatePricingSetting(req({ planId: 'plan', expectedPlanId: null }), stale); assert.equal(stale.code, 409);
  const bad = response(); await controllers.updatePricingSetting(req({ planId: 'plan' }), bad); assert.equal(bad.code, 400);
  plan.studentLimit = 20;
  const capped = response(); await controllers.updatePricingSetting(req({ planId: 'plan', expectedPlanId: 'plan' }), capped); assert.equal(capped.code, 400);
  plan.studentLimit = null;
  const ok = response(); await controllers.updatePricingSetting(req({ planId: 'plan', expectedPlanId: 'plan' }), ok); assert.equal(ok.code, 200);
  const status = response(); await controllers.updatePlanStatus({ ...req({ ativo: false }), params: { id: 'plan' } }, status); assert.equal(status.code, 409); assert.equal(plan.ativo, true);
});
