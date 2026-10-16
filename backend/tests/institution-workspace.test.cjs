const test = require('node:test');
const assert = require('node:assert/strict');
const { institutionRouter } = require('../dist/institution/router');
const { institutionDb: db, effectivePermissions, cleanMembers, cleanText, requireInstitutionSession, requireInstitutionPermission } = require('../dist/institution/policy');

test('institution permissions: coordinator all, teacher explicit grants, student none', () => {
  assert.equal(effectivePermissions('coord', []).length, 5);
  assert.deepEqual(effectivePermissions('professor', ['content.manage', 'unknown']), ['content.manage']);
  assert.deepEqual(effectivePermissions('professor', []), []);
  assert.deepEqual(effectivePermissions('aluno', ['students.manage']), []);
  assert.deepEqual(cleanMembers(['one', 'one', 'two']), ['one', 'two']);
  assert.equal(cleanMembers(['one', 3]), null);
  assert.equal(cleanText('   ', 10), null);
  assert.equal(cleanText(' abc ', 3), 'abc');
});

const currentUser = (overrides = {}) => ({
  id: 'teacher', email: 'teacher@example.invalid', role: 'professor', tenantId: 'tenant-a',
  courseId: 'course-a', studentId: null, permissions: [], tenant: { ativo: true }, ...overrides,
});
const withApi = async (callback) => {
  const request = (path, method = 'GET', body = {}) => new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost');
    const layer = institutionRouter.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(url.pathname));
    assert.ok(layer, method + ' ' + path + ' must exist');
    const req = { body, params: layer.params, query: Object.fromEntries(url.searchParams), user: { id: 'teacher', role: 'coord', tenantId: 'forged-tenant', courseId: 'forged-course' } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { resolve({ status: this.statusCode, json: async () => value }); return this; } };
    Promise.resolve(requireInstitutionSession(req, res, () => layer.route.stack[0].handle(req, res, reject))).catch(reject);
  });
  await callback(request);
};

test('institution routes reload role and binding from database, ignoring stale coordinator JWT', async () => {
  db.user.findUnique = async () => currentUser();
  await withApi(async request => {
    const access = await request('/access');
    assert.deepEqual(await access.json(), { permissions: [] });
    const denied = await request('/notices', 'POST', { title: 'Not allowed', body: 'Not allowed' });
    assert.equal(denied.status, 403);
  });
});

test('disabled institution and deleted session cannot read workspace', async () => {
  await withApi(async request => {
    db.user.findUnique = async () => currentUser({ tenant: { ativo: false } });
    assert.equal((await request('/notices')).status, 403);
    db.user.findUnique = async () => null;
    assert.equal((await request('/access')).status, 401);
  });
});

test('notice reads are scoped to current database institution', async () => {
  db.user.findUnique = async () => currentUser({ role: 'aluno' });
  db.announcement.findMany = async args => {
    assert.deepEqual(args.where, { tenantId: 'tenant-a' });
    assert.equal(args.take, 100);
    return [];
  };
  await withApi(async request => {
    const response = await request('/notices');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  });
});

test('chat requires membership even for coordinators and does not leak messages', async () => {
  db.user.findUnique = async () => currentUser({ role: 'coord' });
  db.conversation.findFirst = async args => {
    assert.equal(args.where.tenantId, 'tenant-a');
    assert.deepEqual(args.where.memberIds, { has: 'teacher' });
    return null;
  };
  await withApi(async request => {
    assert.equal((await request('/conversations/another-tenant/messages')).status, 404);
    assert.equal((await request('/conversations/another-tenant/messages', 'POST', { body: 'Intrusion' })).status, 404);
  });
});

test('teacher with chat permission still cannot add participants from another institution', async () => {
  db.user.findUnique = async () => currentUser({ permissions: ['chat.create'] });
  db.user.count = async args => {
    assert.equal(args.where.tenantId, 'tenant-a');
    return 1;
  };
  await withApi(async request => {
    assert.equal((await request('/conversations', 'POST', { nome: 'Group', memberIds: ['foreign-user'] })).status, 400);
  });
});

test('teacher cannot create periods in a different course, nor grant permissions', async () => {
  db.user.findUnique = async () => currentUser({ permissions: ['content.manage'] });
  await withApi(async request => {
    assert.equal((await request('/periods', 'POST', { nome: 'First', courseId: 'foreign-course' })).status, 400);
    assert.equal((await request('/users/another/access', 'PATCH', { permissions: ['content.manage'], departmentId: null })).status, 403);
  });
});

test('class creation validates every participant in the same institution and course', async () => {
  db.user.findUnique = async () => currentUser({ permissions: ['classes.manage'] });
  db.course.findFirst = async args => {
    assert.deepEqual(args.where, { id: 'course-a', tenantId: 'tenant-a' });
    return { id: 'course-a' };
  };
  db.user.count = async args => {
    assert.equal(args.where.tenantId, 'tenant-a');
    assert.equal(args.where.courseId, 'course-a');
    return 0;
  };
  await withApi(async request => {
    assert.equal((await request('/classes', 'POST', { nome: 'Turma A', courseId: 'course-a', memberIds: ['foreign-student'] })).status, 400);
  });
});

test('access changes refuse users moved to another institution during the request', async () => {
  db.user.findUnique = async () => currentUser({ role: 'coord' });
  db.user.findFirst = async () => ({ id: 'target', role: 'professor' });
  db.user.updateMany = async args => {
    assert.deepEqual(args.where, { id: 'target', tenantId: 'tenant-a', role: 'professor' });
    return { count: 0 };
  };
  await withApi(async request => {
    assert.equal((await request('/users/target/access', 'PATCH', { permissions: ['chat.create'], departmentId: null })).status, 409);
  });
});

test('legacy permission middleware hydrates current grants and revocation applies immediately', async () => {
  const middleware = requireInstitutionPermission('content.manage');
  let grants = ['content.manage'];
  db.user.findUnique = async () => currentUser({ permissions: grants });
  const request = { user: { id: 'teacher', role: 'coord', permissions: ['content.manage'] } };
  let nextCount = 0, status = 200;
  const response = { status(code) { status = code; return this; }, json() { return this; } };
  await middleware(request, response, () => { nextCount++; });
  assert.equal(nextCount, 1);
  assert.deepEqual(request.user.permissions, ['content.manage']);
  assert.equal(request.user.tenantId, 'tenant-a');
  grants = [];
  await middleware(request, response, () => { nextCount++; });
  assert.equal(nextCount, 1);
  assert.equal(status, 403);
  assert.deepEqual(request.user.permissions, []);
});

test('non-coordinators cannot receive directory emails or permission lists', async () => {
  db.user.findUnique = async () => currentUser({ role: 'aluno' });
  db.user.findMany = async () => [{ id: 'peer', nome: 'Peer', email: 'private@example.invalid', role: 'professor', permissions: ['content.manage'], departmentId: null, courseId: 'course-a' }];
  db.user.count = async () => 1;
  db.department.findMany = async () => [];
  db.course.findMany = async () => [];
  await withApi(async request => {
    const response = await request('/directory');
    const data = await response.json();
    assert.equal(data.users[0].email, undefined);
    assert.equal(data.users[0].permissions, undefined);
    assert.equal(data.users[0].nome, 'Peer');
  });
});

test('directory reads bounded stable pages and exposes the next cursor', async () => {
  db.user.findUnique = async () => currentUser({ role: 'coord' });
  db.user.findMany = async args => {
    assert.equal(args.take, 201);
    assert.deepEqual(args.orderBy, { id: 'asc' });
    assert.equal(args.where.tenantId, 'tenant-a');
    return Array.from({ length: 201 }, (_, index) => ({ id: String(index).padStart(4, '0'), nome: 'Person', role: 'aluno', permissions: [] }));
  };
  db.user.count = async () => 1200;
  db.department.findMany = async () => [];
  db.course.findMany = async () => [];
  await withApi(async request => {
    const response = await request('/directory');
    const result = await response.json();
    assert.equal(result.users.length, 200);
    assert.equal(result.nextCursor, '0199');
    assert.equal(result.totalUsers, 1200);
    db.user.findMany = async args => {
      assert.deepEqual(args.where.id, { gt: '0199' });
      assert.equal(args.where.tenantId, 'tenant-a');
      return [];
    };
    const finalPage = await request('/directory?cursor=0199');
    assert.equal((await finalPage.json()).nextCursor, null);
    assert.equal((await request('/directory?cursor=')).status, 400);
  });
});

test('conversation pages include all old rooms through stable membership-scoped cursors', async () => {
  db.user.findUnique = async () => currentUser();
  db.conversation.findMany = async args => {
    assert.equal(args.take, 201);
    assert.equal(args.where.tenantId, 'tenant-a');
    assert.deepEqual(args.where.memberIds, { has: 'teacher' });
    assert.deepEqual(args.orderBy, { id: 'asc' });
    return Array.from({ length: 201 }, (_, index) => ({ id: String(index).padStart(4, '0'), nome: 'Room' }));
  };
  await withApi(async request => {
    const response = await request('/conversations');
    const result = await response.json();
    assert.equal(result.items.length, 200);
    assert.equal(result.nextCursor, '0199');
    db.conversation.findMany = async args => {
      assert.deepEqual(args.where.id, { gt: '0199' });
      assert.equal(args.where.tenantId, 'tenant-a');
      assert.deepEqual(args.where.memberIds, { has: 'teacher' });
      return [];
    };
    const lastPage = await request('/conversations?cursor=0199');
    assert.deepEqual(await lastPage.json(), { items: [], nextCursor: null });
    assert.equal((await request('/conversations?cursor=')).status, 400);
  });
});
