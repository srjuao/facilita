const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
let entitled = false;
let course = { id: 'paid', tenantId: 'tenant-a', paidContent: true, contentPriceCents: 4990, modules: [], exams: [], students: [] };
let account = { id: 'student', role: 'aluno', tenantId: 'tenant-a', courseId: 'primary', permissions: [], tenant: { ativo: true, plan: null } };
let reads = 0;
const lesson = () => ({ id: 'lesson', titulo: 'Actual lesson', videoUrl: 'https://example.invalid/private', module: { id: 'module', courseId: course.id, course, lessons: [] } });
const db = {
  user: { findUnique: async () => account },
  course: { findUnique: async () => ({ ...course, modules: [{ id: 'module', lessons: [lesson()], lista: '[]' }] }) },
  module: { findFirst: async () => ({ id: 'module', courseId: course.id, course }) },
  lesson: { findFirst: async () => lesson(), findUnique: async () => lesson(), findMany: async () => { reads++; return [lesson()]; } },
  exam: { findMany: async () => { reads++; return [{ id: 'exam', _count: { questions: 0 } }]; } },
  courseEntitlement: { findUnique: async () => ({ active: entitled }) },
};
const originalLoad = Module._load;
let courses, lessons, exams;
try {
  Module._load = function(name, ...args) {
    if (name === '@prisma/client') return { PrismaClient: class { constructor() { return db; } } };
    return originalLoad.call(this, name, ...args);
  };
  courses = require('../dist/controllers/course.controller');
  lessons = require('../dist/controllers/lesson.controller');
  exams = require('../dist/controllers/exam.controller');
} finally { Module._load = originalLoad; }
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const request = () => ({ user: { id: 'student', role: 'aluno', tenantId: 'stale', courseId: 'stale' }, params: { id: 'paid' }, query: {} });
test('paid courses, individual lessons, module lists and exams all require a current entitlement', async () => {
  for (const [handler, input] of [
    [courses.getCourseDetails, request()],
    [lessons.getLessonById, { ...request(), params: { id: 'lesson' } }],
    [lessons.getLessonsByModule, { ...request(), query: { moduleId: 'module' } }],
    [exams.getExams, { ...request(), query: { courseId: 'paid' } }],
  ]) {
    entitled = false;
    let res = response(); await handler(input, res); assert.equal(res.code, 403); assert.equal(res.body.code, 'COURSE_ACCESS_REQUIRED');
    assert.equal(res.body.modules, undefined); assert.equal(res.body.videoUrl, undefined);
    entitled = true;
    res = response(); await handler(input, res); assert.equal(res.code, 200);
  }
});
test('revoked extra-course access fails again and foreign tenant is denied even with an entitlement', async () => {
  entitled = false;
  let res = response(); await lessons.getLessonById(request(), res); assert.equal(res.code, 403);
  entitled = true; account = { ...account, tenantId: 'foreign-tenant' };
  res = response(); await courses.getCourseDetails(request(), res); assert.equal(res.code, 403); assert.equal(res.body.modules, undefined);
});
test('legacy exam endpoint filters unpublished/archived records and never leaks question keys', async () => {
  entitled = true; account = { ...account, tenantId: 'tenant-a' };
  db.exam.findMany = async args => {
    assert.deepEqual(args.where, { courseId: 'paid', archivedAt: null, published: true });
    assert.equal(args.select.questions, undefined);
    return [{ id: 'exam', nome: 'Avaliação', published: true, _count: { questions: 1 },
      questions: [{ id: 1, correta: 1, comentario: 'Never disclose', dist: '[1]' }] }];
  };
  const res = response();
  await exams.getExams({ ...request(), query: { courseId: 'paid' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body[0].q, 1);
  assert.equal(res.body[0].questions, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /correta|comentario|Never disclose/);
});
