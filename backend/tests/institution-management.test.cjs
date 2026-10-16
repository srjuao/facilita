const test = require('node:test');
const assert = require('node:assert/strict');
const { institutionRouter } = require('../dist/institution/router');
const { institutionDb: db, requireInstitutionSession } = require('../dist/institution/policy');
const version = '2026-10-16T12:00:00.000Z';
let actor = { id: 'editor', email: 'editor@example.invalid', role: 'coord', tenantId: 'tenant-a', courseId: 'course-a', permissions: [], tenant: { ativo: true } };
db.user.findUnique = async () => actor;
function request(path, method = 'GET', body = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost');
    const layer = institutionRouter.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(url.pathname));
    assert.ok(layer, method + ' ' + path);
    const req = { body, params: layer.params, query: Object.fromEntries(url.searchParams), user: { id: 'editor' } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode, data }); return this; } };
    Promise.resolve(requireInstitutionSession(req, res, () => layer.route.stack[0].handle(req, res, reject))).catch(reject);
  });
}

test('archived notices remain invisible to students even with an archived query', async () => {
  actor = { ...actor, role: 'aluno' };
  db.announcement.findMany = async args => { assert.deepEqual(args.where, { tenantId: 'tenant-a', archivedAt: null }); return []; };
  assert.equal((await request('/notices?archived=true')).status, 200);
  actor = { ...actor, role: 'coord' };
  db.announcement.findMany = async args => { assert.deepEqual(args.where.archivedAt, { not: null }); return []; };
  assert.equal((await request('/notices?archived=true')).status, 200);
});

test('notice edits require current version and are scoped to the institution', async () => {
  assert.equal((await request('/notices/foreign', 'PATCH', { title: 'Title', body: 'Message' })).status, 400);
  db.announcement.findFirst = async args => { assert.equal(args.where.tenantId, 'tenant-a'); return null; };
  assert.equal((await request('/notices/foreign', 'PATCH', { title: 'Title', body: 'Message', expectedUpdatedAt: version })).status, 404);
  db.announcement.findFirst = async () => ({ id: 'notice' });
  db.announcement.updateMany = async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.where.updatedAt.toISOString(), version); assert.ok(args.data.archivedAt instanceof Date); return { count: 0 }; };
  assert.equal((await request('/notices/notice', 'PATCH', { title: 'Title', body: 'Message', archived: true, expectedUpdatedAt: version })).status, 409);
});

test('students cannot edit notices, periods, classes or departments', async () => {
  actor = { ...actor, role: 'aluno', permissions: ['notices.manage', 'classes.manage', 'content.manage'] };
  for (const resource of ['notices', 'periods', 'classes', 'departments']) assert.equal((await request('/' + resource + '/record', 'PATCH', {})).status, 403);
});

test('teacher edits only own course classes and cannot add foreign students', async () => {
  actor = { ...actor, role: 'professor', permissions: ['classes.manage'] };
  db.classGroup.findFirst = async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.where.courseId, 'course-a'); return { id: 'class-a', tenantId: 'tenant-a', courseId: 'course-a', periodId: 'period-a', memberIds: [] }; };
  db.academicPeriod.findFirst = async args => { assert.deepEqual(args.where, { id: 'period-a', tenantId: 'tenant-a', courseId: 'course-a', archivedAt: null }); return { id: 'period-a' }; };
  db.user.count = async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.where.courseId, 'course-a'); return 0; };
  assert.equal((await request('/classes/class-a', 'PATCH', { nome: 'Turma', memberIds: ['foreign'], expectedUpdatedAt: version })).status, 400);
  assert.equal((await request('/classes/class-a', 'PATCH', { nome: 'Turma', memberIds: [], courseId: 'course-b', expectedUpdatedAt: version })).status, 400);
});

test('archiving a class preserves existing historical members without requiring active enrollment', async () => {
  actor = { ...actor, role: 'coord' };
  db.classGroup.findFirst = async () => ({ id: 'class-a', tenantId: 'tenant-a', courseId: 'course-a', periodId: null, memberIds: ['former-student'] });
  db.classGroup.updateMany = async args => { assert.deepEqual(args.data.memberIds, ['former-student']); assert.ok(args.data.archivedAt); return { count: 1 }; };
  assert.equal((await request('/classes/class-a', 'PATCH', { nome: 'Turma', memberIds: ['former-student'], archived: true, expectedUpdatedAt: version })).status, 200);
});

test('archived conversations are read-only and removed members cannot read messages', async () => {
  db.conversation.findFirst = async () => ({ id: 'group', archivedAt: new Date() });
  assert.equal((await request('/conversations/group/messages', 'POST', { body: 'No new message' })).status, 409);
  db.conversation.findFirst = async () => null;
  assert.equal((await request('/conversations/group/messages')).status, 404);
  assert.equal((await request('/conversations/group/messages', 'POST', { body: 'No access' })).status, 404);
});

test('conversation management keeps the editor and locks membership changes', async () => {
  actor = { ...actor, role: 'coord' };
  let locked = false;
  const tx = {
    $queryRaw: async () => { locked = true; return []; },
    user: { count: async () => 1 },
    conversation: {
      findFirst: async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.deepEqual(args.where.memberIds, { has: 'editor' }); return { id: 'group', memberIds: ['editor', 'removed'] }; },
      updateMany: async args => { assert.ok(locked); assert.deepEqual(args.data.memberIds, ['new-member', 'editor']); assert.equal(args.where.updatedAt.toISOString(), version); return { count: 1 }; },
    },
  };
  db.$transaction = async fn => fn(tx);
  assert.equal((await request('/conversations/group', 'PATCH', { nome: 'Group', memberIds: ['new-member'], expectedUpdatedAt: version })).status, 200);
  tx.user.count = async () => 0;
  assert.equal((await request('/conversations/group', 'PATCH', { nome: 'Group', memberIds: ['foreign'], expectedUpdatedAt: version })).status, 400);
});
