const test = require('node:test');
const assert = require('node:assert/strict');
const { contentManagementRouter: router } = require('../dist/institution/content-management');
const { institutionDb: db } = require('../dist/institution/policy');
let actor, course, count;
const stamp = '2026-10-16T15:00:00.000Z';
function reset(role = 'coord') {
  actor = { id: 'actor', email: 'actor@example.invalid', role, tenantId: 'tenant', courseId: 'course', permissions: [], tenant: { ativo: true }, disabledAt: null };
  course = { id: 'course', tenantId: 'tenant' }; count = 1;
  db.user.findUnique = async () => actor;
  db.course.findUnique = async () => course;
  db.$transaction = async callback => callback(db);
  db.$queryRaw = async () => [];
  db.tenant.findFirst = async () => ({ id: 'tenant', ativo: true });
  db.module.findUnique = async () => ({ id: 'module', courseId: 'course', periodId: null });
  db.module.updateMany = async args => { assert.deepEqual(args.where, { id: 'module', updatedAt: new Date(stamp) }); return { count }; };
  db.lesson.findUnique = async () => ({ id: 'lesson', module: { courseId: 'course' } });
  db.lesson.updateMany = async args => { assert.equal(args.data.videoUrl, undefined); return { count }; };
}
function request(path, method = 'GET', body = {}) {
  return new Promise((resolve, reject) => {
    const layer = router.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(path)); assert.ok(layer);
    const handlers = [...router.stack.filter(item => !item.route).map(item => item.handle), ...layer.route.stack.map(item => item.handle)];
    const req = { user: { id: 'actor', role: 'coord', tenantId: 'forged' }, params: layer.params, query: {}, body };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { resolve({ code: this.code, body: value }); return this; } };
    let index = 0; const next = error => { if (error) return reject(error); const handler = handlers[index++]; if (handler) Promise.resolve(handler(req, res, next)).catch(reject); else reject(new Error('No response')); }; next();
  });
}
test('students and employees cannot administer academic content', async () => {
  for (const role of ['aluno', 'staff']) { reset(role); actor.permissions = ['content.manage']; assert.equal((await request('/modules/module', 'PATCH', { nome: 'New', expectedUpdatedAt: stamp })).code, 403); }
});
test('teachers need the current grant and only manage their assigned course', async () => {
  reset('professor'); assert.equal((await request('/modules/module', 'PATCH', { nome: 'New', expectedUpdatedAt: stamp })).code, 403);
  actor.permissions = ['content.manage']; actor.courseId = 'other'; assert.equal((await request('/modules/module', 'PATCH', { nome: 'New', expectedUpdatedAt: stamp })).code, 403);
  actor.courseId = 'course'; assert.equal((await request('/modules/module', 'PATCH', { nome: 'New', expectedUpdatedAt: stamp })).code, 200);
});
test('archival is version checked and cannot alter another tenant', async () => {
  reset(); count = 0; assert.equal((await request('/modules/module', 'PATCH', { archived: true, expectedUpdatedAt: stamp })).code, 409);
  count = 1; course.tenantId = 'foreign'; assert.equal((await request('/modules/module', 'PATCH', { archived: true, expectedUpdatedAt: stamp })).code, 403);
});
test('lesson metadata edit cannot replace a video by mass assignment', async () => {
  reset(); assert.equal((await request('/lessons/lesson', 'PATCH', { titulo: 'Actual title', videoUrl: 'https://malicious.invalid', expectedUpdatedAt: stamp })).code, 200);
});
test('management structure includes archive metadata without video URLs', async () => {
  reset();
  db.module.findMany = async args => { assert.equal(args.where.courseId, 'course'); assert.equal(args.select.lessons.select.videoUrl, undefined); return []; };
  db.academicPeriod.findMany = async args => { assert.equal(args.where.courseId, 'course'); return []; };
  assert.equal((await request('/courses/course/structure')).code, 200);
});
