const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { staffRouter } = require('../dist/institution/staff');
const { institutionDb: db, effectivePermissions } = require('../dist/institution/policy');
let actor = { id: 'coordinator', email: 'coordinator@example.invalid', role: 'coord', tenantId: 'tenant-a', courseId: null, permissions: [], disabledAt: null, tenant: { ativo: true } };
const request = (path, method = 'GET', body = {}) => new Promise((resolve, reject) => {
  const url = new URL(path, 'http://localhost');
  const layer = staffRouter.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(url.pathname));
  assert.ok(layer, path);
  const handlers = [...staffRouter.stack.filter(item => !item.route).map(item => item.handle), ...layer.route.stack.map(item => item.handle)];
  const req = { user: { id: actor.id, role: 'coord', tenantId: 'forged' }, params: layer.params, query: Object.fromEntries(url.searchParams), body };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { resolve({ code: this.code, body: value }); return this; } };
  let index = 0;
  const next = error => { if (error) reject(error); else { const handler = handlers[index++]; if (handler) Promise.resolve(handler(req, res, next)).catch(reject); else reject(new Error('No response')); } };
  next();
});
db.user.findUnique = async () => actor;
const transaction = { $queryRaw: async () => [{ id: 'tenant-a' }], user: {}, department: {} };
db.$transaction = async callback => callback(transaction);
transaction.user.findFirst = async ({ where }) => where.role === 'coord' ? actor : { id: where.id, nome: 'Staff', email: 'staff@example.invalid', permissions: [], departmentId: null, disabledAt: null };
transaction.department.findFirst = async ({ where }) => where.tenantId === 'tenant-a' && where.id === 'department-a' ? { id: 'department-a' } : null;
test('staff permissions do not acquire coordinator or teacher privileges', () => {
  assert.deepEqual(effectivePermissions('staff', ['students.manage', 'content.manage', 'exams.manage', 'chat.create', 'finance.manage']), ['students.manage', 'chat.create']);
});
test('staff management follows current account role and denies disabled accounts', async () => {
  actor = { ...actor, role: 'staff', permissions: ['students.manage'] };
  assert.equal((await request('/')).code, 403);
  actor = { ...actor, role: 'coord', disabledAt: new Date() };
  assert.equal((await request('/')).code, 403);
  actor = { ...actor, disabledAt: null };
});
test('coordinator cannot grant higher permissions or associate another tenant department', async () => {
  const profile = { nome: 'Staff', email: 'staff@example.invalid', password: 'Example-only9!', departmentId: null, permissions: ['exams.manage'] };
  assert.equal((await request('/', 'POST', profile)).code, 400);
  assert.equal((await request('/', 'POST', { ...profile, departmentId: 'foreign', permissions: [] })).code, 400);
});
test('staff creation always binds to current institution and stores only a hash', async () => {
  let data;
  transaction.user.create = async args => { data = args.data; assert.equal(args.select.password, undefined); return { id: 'new-staff', nome: data.nome, email: data.email, permissions: data.permissions, departmentId: null, disabledAt: null }; };
  const result = await request('/', 'POST', { nome: ' New Staff ', email: 'STAFF@example.invalid', password: 'Example-only9!', departmentId: null, permissions: ['notices.manage'], role: 'superadmin', tenantId: 'forged' });
  assert.equal(result.code, 201); assert.equal(data.role, 'staff'); assert.equal(data.tenantId, 'tenant-a'); assert.equal(data.email, 'staff@example.invalid');
  assert.ok(await bcrypt.compare('Example-only9!', data.password)); assert.equal(result.body.user.password, undefined);
});
test('staff status cannot modify another institution or a coordinator', async () => {
  transaction.user.updateMany = async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.equal(args.where.role, 'staff'); return { count: 0 }; };
  assert.equal((await request('/foreign/status', 'PATCH', { active: false })).code, 404);
});
