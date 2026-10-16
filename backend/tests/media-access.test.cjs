const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
process.env.JWT_SECRET = 'test-only-secret-not-used-in-production-12345';
let account = { id: 'user', role: 'aluno', tenantId: 'tenant', courseId: 'course', tenant: { ativo: true, plan: { videoAulas: true } } };
let lesson = { id: 'lesson', videoUrl: '/uploads/videos/video-123.mp4', module: { courseId: 'course', course: { tenantId: 'tenant' } } };
let reads = 0;
const db = { user: { findUnique: async () => { reads++; return account; } }, lesson: { findUnique: async () => { reads++; return lesson; } } };
const originalLoad = Module._load;
let media;
try {
  Module._load = function (name, ...args) { if (name === '@prisma/client') return { PrismaClient: class { constructor() { return db; } } }; return originalLoad.call(this, name, ...args); };
  media = require('../dist/controllers/media-access');
} finally { Module._load = originalLoad; }
function query(url) { return Object.fromEntries(new URL(url, 'https://example.test').searchParams); }
function response() { return { code: 200, headers: {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; }, setHeader(name, value) { this.headers[name] = value; }, sendFile(file) { this.file = file; return this; } }; }
test('signs only strict local video filenames, leaving external providers untouched', () => {
  const local = media.signedLesson(lesson, 'user');
  assert.match(local.videoUrl, /^\/api\/media\/lessons\/lesson\?/);
  assert.equal(media.validMediaSignature('lesson', ...['user', 'expires', 'signature'].map(key => query(local.videoUrl)[key])), true);
  for (const url of ['https://external.test/video.mp4', '/uploads/videos/../secret.mp4', '/uploads/videos/a%2fb.mp4', '/uploads/videos/a.mp4?x=1']) assert.equal(media.localVideoFilename(url), null);
  assert.equal(media.signedLesson({ ...lesson, videoUrl: 'https://external.test/video.mp4' }, 'user').videoUrl, 'https://external.test/video.mp4');
});
test('signature rejects changed user/lesson/expiry, expired and excessively future links', () => {
  const now = Date.now(); const values = query(media.signedLesson(lesson, 'user', now).videoUrl);
  assert.equal(media.validMediaSignature('other', values.user, values.expires, values.signature, now), false);
  assert.equal(media.validMediaSignature('lesson', 'other', values.expires, values.signature, now), false);
  assert.equal(media.validMediaSignature('lesson', 'user', String(Number(values.expires) + 1), values.signature, now), false);
  assert.equal(media.validMediaSignature('lesson', 'user', values.expires, values.signature, now + 7201000), false);
  assert.equal(media.validMediaSignature('lesson', 'user', values.expires, values.signature, now - 100000), false);
  assert.equal(media.validMediaSignature('lesson', ['user'], values.expires, values.signature), false);
});
test('unsigned/forged media requests are denied before database reads', async () => {
  const before = reads; const r = response();
  await media.streamLessonMedia({ params: { id: 'lesson' }, query: {} }, r);
  assert.equal(r.code, 403); assert.equal(reads, before); assert.equal(r.file, undefined);
});
test('stream uses current account permissions and plan, never signature-only authorization', async () => {
  const request = { params: { id: 'lesson' }, query: query(media.signedLesson(lesson, 'user').videoUrl) };
  for (const change of [() => account.tenant.ativo = false, () => account.courseId = 'other-course', () => account.tenantId = 'other-tenant', () => account.tenant.plan.videoAulas = false]) {
    account = { id: 'user', role: 'aluno', tenantId: 'tenant', courseId: 'course', tenant: { ativo: true, plan: { videoAulas: true } } }; change();
    const r = response(); await media.streamLessonMedia(request, r); assert.equal(r.code, 403); assert.equal(r.file, undefined);
  }
  account = { ...account, tenantId: 'tenant', courseId: 'course', tenant: { ativo: true, plan: null } };
  const r = response(); await media.streamLessonMedia(request, r);
  assert.equal(r.code, 200); assert.match(r.file, /uploads\/videos\/video-123\.mp4$/);
  assert.equal(r.headers['Cache-Control'], 'private, no-store'); assert.equal(r.headers['Referrer-Policy'], 'no-referrer');
});
test('deleted user, missing lesson or nonlocal database path cannot be streamed', async () => {
  const request = { params: { id: 'lesson' }, query: query(media.signedLesson(lesson, 'user').videoUrl) };
  account = null; let r = response(); await media.streamLessonMedia(request, r); assert.equal(r.code, 404);
  account = { role: 'superadmin' }; lesson = { ...lesson, videoUrl: '/uploads/videos/../../secret.mp4' };
  r = response(); await media.streamLessonMedia(request, r); assert.equal(r.code, 404); assert.equal(r.file, undefined);
});
