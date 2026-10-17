import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { PaidCourseError } from '../commerce/access';
import { PlanError } from '../controllers/plan-policy';
import { examSettings, questionSettings, serializeQuestion, gradeAnswers } from './policy';

export const assessmentDb = new PrismaClient();
export const assessmentRouter = Router();
export const assessmentsRouter = assessmentRouter;
type Db = Prisma.TransactionClient;
type Account = Prisma.UserGetPayload<{ include: { tenant: { include: { plan: true } } } }>;
type Course = Prisma.CourseGetPayload<Record<string, never>>;
const editorFor = (actor: Account, course: Course) => actor.role === 'superadmin' || actor.role === 'coord' && actor.tenantId === course.tenantId ||
  actor.role === 'professor' && actor.tenantId === course.tenantId && actor.courseId === course.id && actor.permissions.includes('exams.manage');

/** Read fresh role, institution, grant, plan and paid-course entitlement inside the transaction. */
export async function assessmentAccess(tx: Db, req: AuthRequest, courseId: string, editing = false) {
  const actor = await tx.user.findUnique({ where: { id: req.user?.id ?? '' }, include: { tenant: { include: { plan: true } } } });
  if (!actor || actor.disabledAt) throw new PlanError(401, 'Sua conta não está disponível. Entre novamente.');
  const course = await tx.course.findUnique({ where: { id: courseId } });
  if (!course) throw new PlanError(404, 'Curso não encontrado.');
  if (actor.role !== 'superadmin' && (!actor.tenant?.ativo || actor.tenantId !== course.tenantId)) throw new PlanError(403, 'Curso não disponível para esta conta.');
  if (actor.role !== 'superadmin' && actor.tenant?.plan && !actor.tenant.plan.provas) throw new PlanError(403, 'Provas não estão incluídas no plano da instituição.');
  const editor = editorFor(actor, course);
  if (editing && !editor) throw new PlanError(403, 'A coordenação não concedeu permissão para gerenciar avaliações deste curso.');
  if (!editor) {
    if (actor.role !== 'aluno') throw new PlanError(403, 'Sem permissão para avaliações deste curso.');
    const entitlement = await tx.courseEntitlement.findUnique({ where: { courseId_userId: { courseId, userId: actor.id } } });
    if (!entitlement?.active) {
      if (course.paidContent) throw new PaidCourseError(course.id, course.contentPriceCents);
      if (actor.courseId !== course.id) throw new PlanError(403, 'Curso não associado à sua conta.');
    }
  }
  return { actor, course, editor };
}
async function lockActor(tx: Db, req: AuthRequest) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${req.user?.id ?? ''} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: req.user?.id ?? '' }, select: { tenantId: true } });
  if (user?.tenantId) await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${user.tenantId} FOR SHARE`;
}
async function lockedExam(tx: Db, req: AuthRequest, editing = false) {
  await lockActor(tx, req);
  await tx.$queryRaw`SELECT "id" FROM "Exam" WHERE "id" = ${req.params.id} FOR UPDATE`;
  const exam = await tx.exam.findUnique({ where: { id: req.params.id }, include: { questions: { where: { archivedAt: null }, orderBy: { id: 'asc' } } } });
  if (!exam) throw new PlanError(404, 'Avaliação não encontrada.');
  const access = await assessmentAccess(tx, req, exam.courseId, editing);
  if (!access.editor && (!exam.published || exam.archivedAt)) throw new PlanError(404, 'Avaliação não disponível.');
  if (access.actor.role === 'aluno') {
    const finalModule = await tx.module.findUnique({ where: { finalExamId: exam.id }, select: { id: true } });
    if (finalModule) {
      const [lessons, completed] = await Promise.all([
        tx.lesson.count({ where: { moduleId: finalModule.id, archivedAt: null } }),
        tx.lessonCompletion.count({ where: { userId: access.actor.id, lesson: { moduleId: finalModule.id, archivedAt: null } } })
      ]);
      if (completed < lessons) throw new PlanError(403, 'Conclua todas as aulas da matéria antes da prova final.');
    }
  }
  return { exam, ...access };
}
const metadata = (exam: { id: string; nome: string; published: boolean; archivedAt: Date | null; maxAttempts: number; passingScore: number; version: number }) =>
  ({ id: exam.id, nome: exam.nome, published: exam.published, archivedAt: exam.archivedAt, maxAttempts: exam.maxAttempts, passingScore: exam.passingScore, version: exam.version });
const attemptSummary = (attempt: { id: string; number: number; score: number; correct: number; total: number; passed: boolean; createdAt: Date }) =>
  ({ id: attempt.id, number: attempt.number, score: attempt.score, correct: attempt.correct, total: attempt.total, passed: attempt.passed, createdAt: attempt.createdAt });
const handle = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) => (req: AuthRequest, res: Response) => {
  Promise.resolve(fn(req, res)).catch(error => {
    if (error instanceof PaidCourseError) return res.status(error.status).json({ error: error.message, code: error.code, courseId: error.courseId, priceCents: error.priceCents });
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    return res.status(503).json({ error: 'Não foi possível concluir a avaliação. Atualize e tente novamente.' });
  });
};
function requireVersion(body: Record<string, unknown>, version: number) {
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion !== version) throw new PlanError(409, 'A avaliação foi alterada. Atualize antes de continuar.');
}
export async function listAssessments(req: AuthRequest, courseId: string) {
  return assessmentDb.$transaction(async tx => {
    const access = await assessmentAccess(tx, req, courseId);
    const exams = await tx.exam.findMany({ where: { courseId, ...(!access.editor ? { published: true, archivedAt: null } : {}) },
      include: { _count: { select: { questions: { where: { archivedAt: null } }, attempts: { where: { userId: access.actor.id } } } } }, orderBy: { nome: 'asc' } });
    const finalModules = !access.editor ? await tx.module.findMany({ where: { courseId, finalExamId: { not: null } }, select: { id: true, finalExamId: true, lessons: { where: { archivedAt: null }, select: { id: true } } } }) : [];
    const completed = !access.editor ? new Set((await tx.lessonCompletion.findMany({ where: { userId: access.actor.id, lesson: { module: { courseId }, archivedAt: null } }, select: { lessonId: true } })).map(item => item.lessonId)) : new Set<string>();
    return exams.filter(exam => !finalModules.some(module => module.finalExamId === exam.id && module.lessons.some(lesson => !completed.has(lesson.id)))).map(exam => ({ ...metadata(exam), questionCount: exam._count.questions, attemptCount: exam._count.attempts }));
  });
}
assessmentRouter.get('/courses/:courseId/exams', handle(async (req, res) => res.json({ exams: await listAssessments(req, req.params.courseId) })));
// Personal grade summaries remain available after archival or loss of course access.
// Never expose question snapshots or another student's records here.
assessmentRouter.get('/my-results', handle(async (req, res) => {
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursor.length > 160)) throw new PlanError(400, 'Cursor de resultados inválido.');
  const actor = await assessmentDb.user.findUnique({ where: { id: req.user?.id || '' }, include: { tenant: true } });
  if (!actor || actor.disabledAt || actor.role !== 'aluno' || !actor.tenant?.ativo || !actor.tenantId) throw new PlanError(403, 'Seu histórico não está disponível para esta conta.');
  const records = await assessmentDb.examAttempt.findMany({
    where: { userId: actor.id, exam: { course: { tenantId: actor.tenantId } }, ...(cursor ? { id: { lt: cursor } } : {}) },
    include: { exam: { select: { id: true, nome: true, archivedAt: true, course: { select: { id: true, nome: true } } } } },
    orderBy: { id: 'desc' }, take: 101,
  });
  const items = records.slice(0, 100);
  res.json({ attempts: items.map(attempt => ({ ...attemptSummary(attempt), exam: attempt.exam })), nextCursor: records.length > 100 ? items[items.length - 1].id : null });
}));
assessmentRouter.post('/courses/:courseId/exams', handle(async (req, res) => {
  const settings = examSettings(req.body ?? {});
  const exam = await assessmentDb.$transaction(async tx => {
    await lockActor(tx, req);
    await assessmentAccess(tx, req, req.params.courseId, true);
    return tx.exam.create({ data: { ...settings, courseId: req.params.courseId, data: new Date().toISOString(), q: 0 } });
  });
  res.status(201).json({ exam: { ...metadata(exam), questionCount: 0 } });
}));
assessmentRouter.get('/exams/:id', handle(async (req, res) => {
  const result = await assessmentDb.$transaction(async tx => {
    const { exam, editor } = await lockedExam(tx, req);
    return { exam: { ...metadata(exam), questionCount: exam.questions.length, questions: exam.questions.map(question => serializeQuestion(question, editor)) } };
  });
  res.json(result);
}));
assessmentRouter.patch('/exams/:id', handle(async (req, res) => {
  const body = req.body ?? {};
  const exam = await assessmentDb.$transaction(async tx => {
    const { exam } = await lockedExam(tx, req, true);
    requireVersion(body, exam.version);
    if (typeof body.archived === 'boolean') {
      if (Object.keys(body).some(k => !['archived', 'expectedVersion'].includes(k))) throw new PlanError(400, 'Altere o arquivamento separadamente.');
      return tx.exam.update({ where: { id: exam.id }, data: { archivedAt: body.archived ? new Date() : null, version: { increment: 1 } } });
    }
    if (exam.published || exam.archivedAt) throw new PlanError(409, 'Avaliações publicadas ou arquivadas não podem ser alteradas. Crie uma nova avaliação.');
    if (body.published !== undefined && typeof body.published !== 'boolean') throw new PlanError(400, 'Estado de publicação inválido.');
    const settings = examSettings({ nome: body.nome ?? exam.nome, maxAttempts: body.maxAttempts ?? exam.maxAttempts, passingScore: body.passingScore ?? exam.passingScore });
    if (body.published) {
      if (!exam.questions.length) throw new PlanError(400, 'Adicione ao menos uma questão antes de publicar.');
      for (const question of exam.questions) questionSettings({ enunciado: question.enunciado, alternatives: serializeQuestion(question, true).alternatives, correctIndex: question.correta, explanation: question.comentario });
    }
    return tx.exam.update({ where: { id: exam.id }, data: { ...settings, ...(body.published === true ? { published: true } : {}), version: { increment: 1 } } });
  });
  res.json({ exam: metadata(exam) });
}));
assessmentRouter.post('/exams/:id/questions', handle(async (req, res) => {
  const settings = questionSettings(req.body ?? {});
  const question = await assessmentDb.$transaction(async tx => {
    const { exam } = await lockedExam(tx, req, true);
    requireVersion(req.body, exam.version);
    if (exam.published || exam.archivedAt) throw new PlanError(409, 'Somente rascunhos podem receber questões.');
    if (exam.questions.length >= 100) throw new PlanError(400, 'O limite é de 100 questões por avaliação.');
    const question = await tx.question.create({ data: { ...settings, examId: exam.id, courseId: exam.courseId } });
    await tx.exam.update({ where: { id: exam.id }, data: { q: exam.questions.length + 1, version: { increment: 1 } } });
    return serializeQuestion(question, true);
  });
  res.status(201).json({ question });
}));
assessmentRouter.patch('/exams/:id/questions/:questionId', handle(async (req, res) => {
  const questionId = Number(req.params.questionId);
  if (!Number.isSafeInteger(questionId) || questionId < 1) throw new PlanError(400, 'Questão inválida.');
  const body = req.body ?? {};
  const question = await assessmentDb.$transaction(async tx => {
    const { exam } = await lockedExam(tx, req, true);
    requireVersion(body, exam.version);
    if (exam.published || exam.archivedAt) throw new PlanError(409, 'Somente questões de rascunhos podem ser alteradas.');
    if (!exam.questions.some(q => q.id === questionId)) throw new PlanError(404, 'Questão não encontrada nesta avaliação.');
    const updated = await tx.question.update({ where: { id: questionId }, data: body.removed === true ? { archivedAt: new Date() } : questionSettings(body) });
    await tx.exam.update({ where: { id: exam.id }, data: { q: exam.questions.length - (body.removed === true ? 1 : 0), version: { increment: 1 } } });
    return serializeQuestion(updated, true);
  });
  res.json({ question });
}));
assessmentRouter.get('/exams/:id/attempts', handle(async (req, res) => {
  const cursor = req.query?.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length < 1 || cursor.length > 160)) throw new PlanError(400, 'Cursor de resultados inválido.');
  const result = await assessmentDb.$transaction(async tx => {
    const { exam, actor, editor } = await lockedExam(tx, req);
    const attempts = await tx.examAttempt.findMany({ where: { examId: exam.id, ...(!editor ? { userId: actor.id } : {}) },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { nome: true, email: true } } }, orderBy: { id: 'desc' }, take: 101 });
    const items = attempts.slice(0, 100);
    return { attempts: items.map(attempt => ({ ...attemptSummary(attempt), ...(editor ? { user: attempt.user } : {}) })),
      nextCursor: attempts.length > 100 ? items[items.length - 1].id : null };
  });
  res.json(result);
}));
assessmentRouter.post('/exams/:id/attempts', handle(async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.submissionId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.submissionId) || !Number.isSafeInteger(body.examVersion)) throw new PlanError(400, 'Identificador de envio ou versão da avaliação inválidos.');
  const result = await assessmentDb.$transaction(async tx => {
    const { exam, actor } = await lockedExam(tx, req);
    if (actor.role !== 'aluno' || !exam.published || exam.archivedAt) throw new PlanError(403, 'Somente alunos podem responder avaliações publicadas.');
    const previous = await tx.examAttempt.findUnique({ where: { userId_submissionId: { userId: actor.id, submissionId: body.submissionId } } });
    if (previous) {
      if (previous.examId !== exam.id) throw new PlanError(409, 'Este envio já foi utilizado em outra avaliação.');
      return { attempt: attemptSummary(previous), feedback: previous.snapshot };
    }
    if (body.examVersion !== exam.version) throw new PlanError(409, 'A avaliação foi atualizada. Reabra antes de enviar.');
    const count = await tx.examAttempt.count({ where: { examId: exam.id, userId: actor.id } });
    if (count >= exam.maxAttempts) throw new PlanError(409, 'Você já utilizou todas as tentativas desta avaliação.');
    const grade = gradeAnswers(exam.questions, body.answers);
    const attempt = await tx.examAttempt.create({ data: { examId: exam.id, userId: actor.id, submissionId: body.submissionId, number: count + 1,
      score: grade.score, correct: grade.correct, total: grade.total, passed: grade.score >= exam.passingScore, snapshot: grade.feedback } });
    return { attempt: attemptSummary(attempt), feedback: grade.feedback };
  });
  res.status(201).json(result);
}));
