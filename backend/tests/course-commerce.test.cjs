const test = require('node:test');
const assert = require('node:assert/strict');
const { commerceRouter: router } = require('../dist/commerce/router');
const { commerceDb: db, assertCourseContentAccess, PaidCourseError, parseCoursePrice } = require('../dist/commerce/access');
const { institutionDb } = require('../dist/institution/policy');
const course = { id: 'course-a', tenantId: 'tenant-a', nome: 'Curso', paidContent: true, contentPriceCents: 4990, saleVersion: 0 };
let account;
const reset = (role = 'coord') => {
  account = { id: 'actor', email: 'actor@example.invalid', role, tenantId: 'tenant-a', courseId: 'course-a', permissions: [], studentId: null, tenant: { ativo: true } };
  institutionDb.user.findUnique = async () => account;
  db.$transaction = async action => action(db);
  db.$queryRaw = async () => [];
  db.user.findFirst = async args => args.where.id === 'actor' ? account : null;
  db.course.findFirst = async args => args.where.id === course.id && args.where.tenantId === course.tenantId ? course : null;
  db.courseEntitlement.findUnique = async () => null;
};
const request = (path, method = 'GET', body = {}) => new Promise((resolve, reject) => {
  const url = new URL(path, 'http://localhost');
  const layer = router.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(url.pathname));
  assert.ok(layer);
  const req = { body, params: layer.params, query: Object.fromEntries(url.searchParams), user: { id: 'actor', role: 'coord', tenantId: 'forged' } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode, data }); return this; } };
  const layers = [...router.stack.filter(item => !item.route), ...layer.route.stack];
  let index = 0;
  const next = error => {
    if (error) return reject(error);
    try { Promise.resolve(layers[index++].handle(req, res, next)).catch(reject); } catch (cause) { reject(cause); }
  };
  next();
});

test('paid access never follows stale JWT role: fresh teacher/student cannot manage offers', async () => {
  reset('professor');
  assert.equal((await request('/courses/course-a/offer', 'PATCH', { paidContent: true, price: '49,90', expectedVersion: 0 })).status, 403);
  reset('aluno');
  assert.equal((await request('/courses/course-a/access/student', 'PATCH', { active: true, reason: 'Manual' })).status, 403);
  reset('superadmin');
  assert.equal((await request('/catalog')).status, 403);
  reset('aluno'); account.tenant.ativo = false;
  assert.equal((await request('/catalog')).status, 403);
});
test('price parsing uses integer cents and refuses exponent/negative/excess values', () => {
  assert.equal(parseCoursePrice('49,90'), 4990);
  assert.equal(parseCoursePrice('49.9'), 4990);
  assert.equal(parseCoursePrice('1000000'), 100000000);
  for (const price of ['-1', '1e3', '1.234', '1000000,01', '', 4990]) assert.throws(() => parseCoursePrice(price));
});
test('paid primary course is blocked until an active grant, and revoke applies immediately', async () => {
  reset('aluno');
  await assert.rejects(assertCourseContentAccess(account, course), error => error instanceof PaidCourseError && error.code === 'COURSE_ACCESS_REQUIRED' && error.courseId === course.id && error.priceCents === 4990);
  db.courseEntitlement.findUnique = async () => ({ active: true });
  await assertCourseContentAccess(account, course);
  db.courseEntitlement.findUnique = async () => ({ active: false });
  await assert.rejects(assertCourseContentAccess(account, course), PaidCourseError);
});
test('additional granted course works only for same-institution registered students', async () => {
  reset('aluno'); account.courseId = 'other-course';
  db.courseEntitlement.findUnique = async () => ({ active: true });
  await assertCourseContentAccess(account, course);
  await assert.rejects(assertCourseContentAccess({ ...account, tenantId: 'foreign' }, course));
  await assert.rejects(assertCourseContentAccess({ ...account, role: 'professor' }, course));
  db.courseEntitlement.findUnique = async () => null;
  await assert.rejects(assertCourseContentAccess(account, { ...course, paidContent: false }));
  await assertCourseContentAccess({ ...account, courseId: course.id }, { ...course, paidContent: false });
});
test('missing commerce projection fails closed instead of treating paid course as included', async () => {
  reset('aluno');
  await assert.rejects(assertCourseContentAccess(account, { id: course.id, tenantId: course.tenantId }), error => error.status === 503);
});
test('catalog query scopes all paid/assigned/granted courses to current institution', async () => {
  reset('aluno');
  db.course.findMany = async args => {
    assert.equal(args.where.tenantId, 'tenant-a');
    assert.deepEqual(args.where.OR[2], { entitlements: { some: { userId: 'actor', active: true } } });
    return [{ ...course, entitlements: [], accessRequests: [{ quotedPriceCents: 4500 }] }];
  };
  const response = await request('/catalog');
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.courses[0], { id: course.id, nome: course.nome, paidContent: true, contentPriceCents: 4990, saleVersion: 0, hasAccess: false, requested: true, quotedPriceCents: 4500 });
});
test('foreign course cannot be requested or offered', async () => {
  reset('aluno');
  assert.equal((await request('/courses/foreign/request', 'POST')).status, 404);
  reset();
  assert.equal((await request('/courses/foreign/offer', 'PATCH', { paidContent: true, price: '49,90', expectedVersion: 0 })).status, 404);
});
test('request preserves original quoted price and never creates payment or grants access', async () => {
  reset('aluno');
  db.courseAccessRequest.upsert = async args => {
    assert.deepEqual(args.update, {});
    assert.equal(args.create.userId, 'actor');
    assert.equal(args.create.quotedPriceCents, 4990);
    return { id: 'request', quotedPriceCents: 4500 };
  };
  const response = await request('/courses/course-a/request', 'POST');
  assert.equal(response.status, 201);
  assert.equal(response.data.request.quotedPriceCents, 4500);
  assert.match(response.data.message, /não confirma pagamento/);
  assert.equal(response.data.payment, undefined);
});
test('role/tenant changed during write cannot grant or request access', async () => {
  reset();
  db.user.findFirst = async () => null;
  assert.equal((await request('/courses/course-a/access/student', 'PATCH', { active: true, reason: 'Manual' })).status, 403);
  reset('aluno');
  db.user.findFirst = async () => null;
  assert.equal((await request('/courses/course-a/request', 'POST')).status, 403);
});
test('manual grants reject foreign students and teacher accounts', async () => {
  reset();
  db.user.findFirst = async args => {
    if (args.where.id === 'actor') return account;
    assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.where.role, 'aluno');
    return null;
  };
  assert.equal((await request('/courses/course-a/access/foreign', 'PATCH', { active: true, reason: 'Manual' })).status, 404);
});
test('grant and revoke append audit events, no payment claim', async () => {
  reset();
  db.user.findFirst = async args => args.where.id === 'actor' ? account : { id: 'student' };
  const events = [];
  db.courseEntitlement.upsert = async args => {
    assert.equal(args.create.userId, 'student'); assert.equal(args.create.actorId, 'actor');
    return { active: args.update.active };
  };
  db.courseAccessEvent.create = async args => { events.push(args.data); return args.data; };
  for (const active of [true, false]) {
    const response = await request('/courses/course-a/access/student', 'PATCH', { active, reason: 'Liberação administrativa' });
    assert.equal(response.status, 200);
    assert.match(response.data.message, /não é uma confirmação de pagamento/);
  }
  assert.deepEqual(events.map(event => event.action), ['GRANT', 'REVOKE']);
  assert.ok(events.every(event => event.courseId === course.id && event.actorId === 'actor'));
});
test('offer versions conflict rather than silently overwriting another coordinator', async () => {
  reset();
  db.course.updateMany = async args => {
    assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.where.saleVersion, 0);
    assert.equal(args.data.contentPriceCents, 4990);
    return { count: 0 };
  };
  assert.equal((await request('/courses/course-a/offer', 'PATCH', { paidContent: true, price: '49,90', expectedVersion: 0 })).status, 409);
  assert.equal((await request('/courses/course-a/offer', 'PATCH', { paidContent: true, price: '0', expectedVersion: 0 })).status, 400);
});
test('access directory is institution-scoped, bounded and paginated', async () => {
  reset();
  db.user.findMany = async args => {
    assert.deepEqual(args.where, { tenantId: 'tenant-a', role: 'aluno', id: { gt: '0001' } });
    assert.equal(args.take, 201);
    return Array.from({ length: 201 }, (_, index) => ({ id: String(index).padStart(4, '0'), nome: 'Student', email: 'student@example.invalid', courseId: 'course-a', courseEntitlements: [], courseAccessRequests: [] }));
  };
  const response = await request('/courses/course-a/access?cursor=0001');
  assert.equal(response.data.students.length, 200);
  assert.equal(response.data.nextCursor, '0199');
  assert.equal(response.data.students[0].hasAccess, false);
  assert.equal(response.data.students[0].included, false);
  assert.equal(response.data.students[0].manualAccess, false);
  assert.equal((await request('/courses/course-a/access?cursor=')).status, 400);
});
test('primary included membership is distinguished from manual grants in access directory', async () => {
  reset();
  db.course.findFirst = async () => ({ ...course, paidContent: false, contentPriceCents: 0 });
  db.user.findMany = async () => [{ id: 'student', nome: 'Student', email: 'student@example.invalid', courseId: course.id, courseEntitlements: [{ active: false, reason: 'Manual revogado' }], courseAccessRequests: [] }];
  const response = await request('/courses/course-a/access');
  assert.equal(response.data.students[0].hasAccess, true);
  assert.equal(response.data.students[0].included, true);
  assert.equal(response.data.students[0].manualAccess, false);
});
