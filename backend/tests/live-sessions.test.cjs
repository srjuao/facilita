const test = require('node:test');
const assert = require('node:assert/strict');
const { liveRouter } = require('../dist/live/router');
const { institutionDb: db, requireInstitutionSession, effectivePermissions } = require('../dist/institution/policy');

const actor = (role = 'coord', overrides = {}) => ({
  id: 'user-a', email: 'user@example.invalid', role, tenantId: 'tenant-a',
  courseId: role === 'coord' ? null : 'course-a', permissions: [], disabledAt: null,
  tenant: { ativo: true }, ...overrides,
});
const request = (path, method = 'GET', body = {}) => new Promise((resolve, reject) => {
  const url = new URL(path, 'http://localhost');
  const layer = liveRouter.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(url.pathname));
  assert.ok(layer, `${method} ${path} must exist`);
  const req = { body, params: layer.params, query: Object.fromEntries(url.searchParams), user: { id: 'user-a', role: 'superadmin', tenantId: 'forged' } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, setHeader() { return this; }, json(value) { resolve({ status: this.statusCode, body: value }); return this; } };
  Promise.resolve(requireInstitutionSession(req, res, () => layer.route.stack[0].handle(req, res, reject))).catch(reject);
});

test('LiveKit permission is explicit for teachers and never granted to students', () => {
  assert.ok(effectivePermissions('coord', []).includes('live.manage'));
  assert.deepEqual(effectivePermissions('professor', ['live.manage']), ['live.manage']);
  assert.deepEqual(effectivePermissions('aluno', ['live.manage']), []);
});

test('live session lookup is tenant-scoped and refuses foreign room', async () => {
  db.user.findUnique = async () => actor();
  db.liveSession.findFirst = async args => {
    assert.deepEqual(args.where, { id: 'foreign', tenantId: 'tenant-a' });
    return null;
  };
  assert.equal((await request('/foreign/join', 'POST')).status, 404);
});

test('teachers cannot create sessions and cannot start without a grant', async () => {
  db.user.findUnique = async () => actor('professor');
  assert.equal((await request('/', 'POST', { title: 'Test', startsAt: '2026-10-17T12:00:00Z', endsAt: '2026-10-17T13:00:00Z' })).status, 403);
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: 'course-a', status: 'scheduled' });
  assert.equal((await request('/room-a/start', 'POST')).status, 403);
});

test('scheduled class cannot issue token to student, and lists are tenant-scoped', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: 'course-a', classGroupId: 'class-a', status: 'scheduled' });
  assert.equal((await request('/room-a/join', 'POST')).status, 409);
  db.courseEntitlement.findMany = async () => [];
  db.course.findFirst = async () => ({ id: 'course-a', paidContent: false });
  db.liveSession.findMany = async args => {
    assert.equal(args.where.tenantId ?? args.where.AND?.[0]?.tenantId, 'tenant-a');
    return [];
  };
  const list = await request('/');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body, { items: [] });
});

test('student not in the class cannot join a live room', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: 'course-a', classGroupId: 'class-a', status: 'live', endsAt: new Date(Date.now() + 3600000) });
  db.classGroup.findFirst = async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.deepEqual(args.where.memberIds, { has: 'user-a' }); return null; };
  assert.equal((await request('/room-a/join', 'POST')).status, 403);
});

test('room start fails closed without private-room configuration and does not write state', async () => {
  db.user.findUnique = async () => actor('coord');
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: 'course-a', status: 'scheduled', startsAt: new Date(), endsAt: new Date(Date.now() + 3600000) });
  db.liveSession.updateMany = async () => { throw new Error('start must not modify the session without safe LiveKit config'); };
  assert.equal((await request('/room-a/start', 'POST')).status, 503);
});

test('ending state rejects joins before a token is minted', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: null, classGroupId: null, status: 'ending' });
  assert.equal((await request('/room-a/join', 'POST')).status, 409);
});

test('student session list filters authorized course and class before the database limit', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.courseEntitlement.findMany = async () => [{ courseId: 'paid-course-a' }];
  db.course.findFirst = async () => ({ id: 'course-a', paidContent: false });
  let queries = 0;
  db.liveSession.findMany = async args => {
    queries++;
    const scope = args.where.AND?.[0] ?? args.where;
    assert.equal(scope.tenantId, 'tenant-a');
    assert.deepEqual(scope.OR[1].courseId.in.sort(), ['course-a', 'paid-course-a']);
    assert.equal(scope.OR[1].OR[1].classGroup.memberIds.has, 'user-a');
    return [];
  };
  assert.equal((await request('/')).status, 200);
  assert.equal(queries, 3);
});

test('coordinator list includes transitional rooms for start/end recovery', async () => {
  db.user.findUnique = async () => actor('coord');
  let queries = 0;
  db.liveSession.findMany = async args => {
    queries++;
    assert.equal(args.where.tenantId ?? args.where.AND?.[0]?.tenantId, 'tenant-a');
    if (args.where.status?.in) {
      assert.deepEqual(args.where.status.in, ['live', 'starting', 'ending']);
      return [{ id: 'starting-a', status: 'starting' }, { id: 'ending-a', status: 'ending' }];
    }
    return [];
  };
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items.map(item => item.status), ['starting', 'ending']);
  assert.equal(queries, 3);
});
