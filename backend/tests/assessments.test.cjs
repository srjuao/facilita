const test = require('node:test');
const assert = require('node:assert/strict');
const { assessmentRouter: router, assessmentDb: db } = require('../dist/assessments/router');
const { serializeQuestion, gradeAnswers, questionSettings, examSettings } = require('../dist/assessments/policy');
const question = { id: 1, enunciado: 'Questão real', alts: '["A","B"]', correta: 1, comentario: 'Explicação', archivedAt: null };
let account, exam, attempts, entitlement, locks;
function reset(role = 'aluno') {
  account = { id: 'actor', role, tenantId: 'tenant', courseId: 'course', permissions: [], disabledAt: null, tenant: { ativo: true, plan: { provas: true } } };
  exam = { id: 'exam', nome: 'Prova', published: true, archivedAt: null, courseId: 'course', maxAttempts: 1, passingScore: 7, version: 0, questions: [question] };
  attempts = []; entitlement = null; locks = [];
  db.$transaction = async action => action(db);
  db.$queryRaw = async (parts, ...values) => { locks.push([parts.join('?'), values]); return []; };
  db.user.findUnique = async () => account;
  db.course.findUnique = async () => ({ id: 'course', tenantId: 'tenant', paidContent: false, contentPriceCents: 0 });
  db.courseEntitlement.findUnique = async () => entitlement;
  db.exam.findUnique = async () => exam;
  db.exam.update = async args => ({ ...exam, ...args.data, version: exam.version + 1 });
  db.exam.findMany = async args => {
    if (account.role === 'aluno') assert.deepEqual(args.where, { courseId: 'course', published: true, archivedAt: null });
    return [{ ...exam, _count: { questions: 1, attempts: attempts.length } }];
  };
  db.examAttempt.findUnique = async args => attempts.find(a => a.userId === args.where.userId_submissionId.userId && a.submissionId === args.where.userId_submissionId.submissionId) ?? null;
  db.examAttempt.count = async () => attempts.length;
  db.examAttempt.create = async args => { const row = { ...args.data, id: 'attempt-' + attempts.length, createdAt: new Date() }; attempts.push(row); return row; };
  db.examAttempt.findMany = async () => attempts.map(a => ({ ...a, user: { nome: 'Aluno', email: 'student@example.invalid' } }));
}
function request(path, method = 'GET', body = {}) {
  return new Promise((resolve, reject) => {
    const layer = router.stack.find(l => l.route && l.route.methods[method.toLowerCase()] && l.match(path));
    assert.ok(layer);
    const req = { body, params: layer.params, query: {}, user: { id: 'actor', role: 'superadmin', tenantId: 'forged' } };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { resolve({ status: this.code, data }); } };
    try { layer.route.stack[0].handle(req, res, reject); } catch (error) { reject(error); }
  });
}
const submit = (extra = {}) => ({ submissionId: 'stable-submission-key', examVersion: 0, answers: [{ questionId: 1, alternativeIndex: 1 }], ...extra });
test('student projection excludes answer key, explanations and legacy distribution', () => {
  const output = serializeQuestion({ ...question, dist: '[99]', erro: 99 }, false);
  assert.deepEqual(output, { id: 1, enunciado: 'Questão real', alternatives: ['A', 'B'] });
  assert.equal(serializeQuestion(question, true).correctIndex, 1);
});
test('grading is server-side, exhaustive and rejects duplicated, foreign or forged answers', () => {
  assert.equal(gradeAnswers([question], [{ questionId: 1, alternativeIndex: 1 }]).score, 10);
  assert.equal(gradeAnswers([question], [{ questionId: 1, alternativeIndex: 0 }]).score, 0);
  for (const answers of [[], [{ questionId: 99, alternativeIndex: 1 }], [{ questionId: 1, alternativeIndex: 2 }], [{ questionId: 1, alternativeIndex: 1, score: 10 }], [{ questionId: 1, alternativeIndex: 1 }, { questionId: 1, alternativeIndex: 1 }]]) {
    assert.throws(() => gradeAnswers([question], answers));
  }
});
test('questions and assessment settings have strict lengths and numeric ranges', () => {
  assert.throws(() => examSettings({ nome: 'Test', maxAttempts: 0, passingScore: 7 }));
  assert.throws(() => examSettings({ nome: 'Test', maxAttempts: 1, passingScore: NaN }));
  assert.throws(() => questionSettings({ enunciado: 'Q', alternatives: ['A'], correctIndex: 0 }));
  assert.throws(() => questionSettings({ enunciado: 'Q', alternatives: ['A', ''], correctIndex: 0 }));
});
test('student detail and list hide grading key before submission', async () => {
  reset();
  const detail = await request('/exams/exam');
  assert.equal(detail.status, 200);
  assert.equal(detail.data.exam.questions[0].correctIndex, undefined);
  assert.equal(detail.data.exam.questions[0].explanation, undefined);
  const list = await request('/courses/course/exams');
  assert.equal(list.data.exams[0].questionCount, 1);
  assert.equal(list.data.exams[0].questions, undefined);
});
test('draft and archived evaluations cannot be read or submitted by students', async () => {
  reset(); exam.published = false;
  assert.equal((await request('/exams/exam')).status, 404);
  assert.equal((await request('/exams/exam/attempts', 'POST', submit())).status, 404);
  exam.published = true; exam.archivedAt = new Date();
  assert.equal((await request('/exams/exam')).status, 404);
});
test('stale JWT cannot authorize a foreign, disabled, inactive or plan-revoked account', async () => {
  for (const mutate of [a => a.tenantId = 'foreign', a => a.disabledAt = new Date(), a => a.tenant.ativo = false, a => a.tenant.plan.provas = false]) {
    reset(); mutate(account);
    assert.ok([401, 403].includes((await request('/exams/exam/attempts', 'POST', submit())).status));
    assert.equal(attempts.length, 0);
  }
});
test('teacher edit requires current explicit grant and own course', async () => {
  reset('professor'); exam.published = false;
  const settings = { nome: 'Atualizada', maxAttempts: 2, passingScore: 6, expectedVersion: 0 };
  assert.equal((await request('/exams/exam', 'PATCH', settings)).status, 403);
  account.permissions = ['exams.manage'];
  assert.equal((await request('/exams/exam', 'PATCH', settings)).status, 200);
  account.courseId = 'foreign';
  assert.equal((await request('/exams/exam', 'PATCH', settings)).status, 403);
});
test('paid assessment requires an active current course entitlement', async () => {
  reset();
  db.course.findUnique = async () => ({ id: 'course', tenantId: 'tenant', paidContent: true, contentPriceCents: 4990 });
  assert.equal((await request('/exams/exam')).data.code, 'COURSE_ACCESS_REQUIRED');
  entitlement = { active: true };
  assert.equal((await request('/exams/exam')).status, 200);
  entitlement.active = false;
  assert.equal((await request('/exams/exam')).status, 403);
});
test('published evaluation cannot change metadata or questions, can archive without deleting attempts', async () => {
  reset('coord');
  assert.equal((await request('/exams/exam', 'PATCH', { nome: 'Changed', expectedVersion: 0 })).status, 409);
  assert.equal((await request('/exams/exam/questions', 'POST', { enunciado: 'Q', alternatives: ['A', 'B'], correctIndex: 1, expectedVersion: 0 })).status, 409);
  const archived = await request('/exams/exam', 'PATCH', { archived: true, expectedVersion: 0 });
  assert.equal(archived.status, 200);
  assert.ok(archived.data.exam.archivedAt);
});
test('publishing needs validated live questions and a matching version', async () => {
  reset('coord'); exam.published = false; exam.questions = [];
  assert.equal((await request('/exams/exam', 'PATCH', { published: true, expectedVersion: 0 })).status, 400);
  exam.questions = [question];
  assert.equal((await request('/exams/exam', 'PATCH', { published: true, expectedVersion: 99 })).status, 409);
  assert.equal((await request('/exams/exam', 'PATCH', { published: true, expectedVersion: 0 })).status, 200);
});
test('submission grades, stores immutable feedback and idempotently retries without a second attempt', async () => {
  reset();
  const first = await request('/exams/exam/attempts', 'POST', submit({ score: 999 }));
  assert.equal(first.status, 201);
  assert.equal(first.data.attempt.score, 10);
  assert.equal(first.data.attempt.passed, true);
  assert.equal(first.data.feedback[0].correctIndex, 1);
  const retry = await request('/exams/exam/attempts', 'POST', submit());
  assert.equal(retry.data.attempt.id, first.data.attempt.id);
  assert.equal(attempts.length, 1);
  assert.ok(locks.some(([sql]) => /FROM "Exam".*FOR UPDATE/.test(sql)));
  assert.ok(locks.some(([sql]) => /FROM "User".*FOR UPDATE/.test(sql)));
  const extra = await request('/exams/exam/attempts', 'POST', submit({ submissionId: 'different-submission-key' }));
  assert.equal(extra.status, 409);
});
test('no attempts from stale version, missing answers or teacher role', async () => {
  reset();
  assert.equal((await request('/exams/exam/attempts', 'POST', submit({ examVersion: 99 }))).status, 409);
  assert.equal((await request('/exams/exam/attempts', 'POST', submit({ answers: [] }))).status, 400);
  reset('coord');
  assert.equal((await request('/exams/exam/attempts', 'POST', submit())).status, 403);
  assert.equal(attempts.length, 0);
});
test('attempt history exposes no feedback snapshots or foreign student details to students', async () => {
  reset();
  await request('/exams/exam/attempts', 'POST', submit());
  const result = await request('/exams/exam/attempts');
  assert.equal(result.data.attempts[0].snapshot, undefined);
  assert.equal(result.data.attempts[0].user, undefined);
  account.role = 'coord';
  const managed = await request('/exams/exam/attempts');
  assert.equal(managed.data.attempts[0].user.nome, 'Aluno');
});
test('attempt directory is bounded and returns stable pages without answer snapshots', async () => {
  reset('coord');
  db.examAttempt.findMany = async args => {
    assert.equal(args.take, 101);
    assert.deepEqual(args.orderBy, { id: 'desc' });
    return Array.from({ length: 101 }, (_, index) => ({ id: String(200 - index), number: 1, score: 10, correct: 1, total: 1, passed: true, createdAt: new Date(), user: { nome: 'Aluno' } }));
  };
  const result = await request('/exams/exam/attempts');
  assert.equal(result.data.attempts.length, 100);
  assert.equal(result.data.nextCursor, '101');
});
test('personal grade history stays available after archival or plan change without leaking snapshots', async () => {
  reset(); exam.archivedAt = new Date(); account.tenant.plan.provas = false;
  db.examAttempt.findMany = async args => {
    assert.equal(args.where.userId, 'actor');
    assert.deepEqual(args.where.exam, { course: { tenantId: 'tenant' } });
    assert.equal(args.take, 101);
    return [{ id: 'result', number: 1, score: 10, correct: 1, total: 1, passed: true, createdAt: new Date(), snapshot: [{ correctIndex: 1 }], user: { nome: 'Private' }, exam: { id: 'exam', nome: 'Archived', archivedAt: exam.archivedAt, course: { id: 'course', nome: 'Course' } } }];
  };
  const result = await request('/my-results');
  assert.equal(result.status, 200); assert.equal(result.data.attempts[0].score, 10);
  assert.equal(result.data.attempts[0].snapshot, undefined); assert.equal(result.data.attempts[0].user, undefined);
  account.disabledAt = new Date(); assert.equal((await request('/my-results')).status, 403);
  reset('staff'); assert.equal((await request('/my-results')).status, 403);
});
