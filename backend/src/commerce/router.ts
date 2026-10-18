import { Router, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { InstitutionRequest, requireInstitutionSession, cleanText } from '../institution/policy';
import { PlanError } from '../controllers/plan-policy';
import { commerceDb as db, parseCoursePrice } from './access';
import { notifyCourseLinked } from '../notifications/service';

export const commerceRouter = Router();
const courseSelect = { id: true, nome: true, tenantId: true, paidContent: true, contentPriceCents: true, saleVersion: true } as const;
const route = (handler: (req: InstitutionRequest, res: Response) => Promise<unknown>) => (req: InstitutionRequest, res: Response, _next: NextFunction) => {
  Promise.resolve(handler(req, res)).catch((error: unknown) => {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    if ((error as { code?: string })?.code === 'P2002') return res.status(409).json({ error: 'O registro foi alterado. Atualize e tente novamente.' });
    res.status(503).json({ error: 'Não foi possível concluir esta ação. Tente novamente.' });
  });
};
commerceRouter.use(requireInstitutionSession);
commerceRouter.use((req: InstitutionRequest, res, next) => {
  if (!req.institution?.tenantId || !['coord', 'aluno'].includes(req.institution.role)) return res.status(403).json({ error: 'Acesse com uma conta de coordenação ou aluno desta instituição.' });
  next();
});
function requireRole(req: InstitutionRequest, role: string) {
  if (req.institution?.role !== role) throw new PlanError(403, role === 'coord' ? 'Somente a coordenação pode gerenciar ofertas e liberar acessos.' : 'Esta ação é exclusiva dos alunos cadastrados.');
}
async function ownCourse(req: InstitutionRequest) {
  const course = await db.course.findFirst({ where: { id: req.params.id, tenantId: req.institution!.tenantId }, select: courseSelect });
  if (!course) throw new PlanError(404, 'Curso não encontrado nesta instituição.');
  return course;
}
/** Lock current account bindings and course so a concurrent transfer cannot authorize a write. */
async function lockedContext(tx: Prisma.TransactionClient, req: InstitutionRequest, role: string, targetId?: string) {
  const session = req.institution!;
  const ids = [...new Set([session.id, ...(targetId ? [targetId] : [])])].sort();
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${session.tenantId} FOR SHARE`;
  const actor = await tx.user.findFirst({ where: { id: session.id, tenantId: session.tenantId, role, tenant: { ativo: true } } });
  if (!actor) throw new PlanError(403, 'Seu vínculo foi alterado. Entre novamente.');
  const course = await tx.course.findFirst({ where: { id: req.params.id, tenantId: session.tenantId }, select: courseSelect });
  if (!course) throw new PlanError(404, 'Curso não encontrado nesta instituição.');
  return course;
}

commerceRouter.get('/catalog', route(async (req, res) => {
  const session = req.institution!;
  const student = session.role === 'aluno';
  const courses = await db.course.findMany({
    where: { tenantId: session.tenantId, ...(student ? { OR: [{ paidContent: true }, { id: session.courseId ?? '' }, { entitlements: { some: { userId: session.id, active: true } } }] } : {}) },
    select: { ...courseSelect, entitlements: { where: { userId: session.id }, select: { active: true } }, accessRequests: { where: { userId: session.id }, select: { quotedPriceCents: true } } },
    orderBy: { nome: 'asc' },
  });
  res.json({ courses: courses.map(({ tenantId: _tenantId, entitlements, accessRequests, ...course }) => ({ ...course,
    hasAccess: !student || Boolean(entitlements[0]?.active) || (!course.paidContent && course.id === session.courseId),
    requested: accessRequests.length > 0, ...(accessRequests.length ? { quotedPriceCents: accessRequests[0].quotedPriceCents } : {}),
  })) });
}));

commerceRouter.patch('/courses/:id/offer', route(async (req, res) => {
  requireRole(req, 'coord');
  const { paidContent, expectedVersion, price } = req.body ?? {};
  if (typeof paidContent !== 'boolean' || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || expectedVersion >= 2147483647) throw new PlanError(400, 'Informe modalidade e versão válidas da oferta.');
  const cents = parseCoursePrice(price);
  if (paidContent && cents < 1) throw new PlanError(400, 'Cursos pagos devem ter preço maior que zero.');
  const course = await db.$transaction(async tx => {
    await lockedContext(tx, req, 'coord');
    const updated = await tx.course.updateMany({ where: { id: req.params.id, tenantId: req.institution!.tenantId, saleVersion: expectedVersion }, data: { paidContent, contentPriceCents: paidContent ? cents : 0, saleVersion: { increment: 1 } } });
    if (!updated.count) throw new PlanError(409, 'Esta oferta foi alterada. Atualize a página antes de salvar.');
    return tx.course.findUniqueOrThrow({ where: { id: req.params.id }, select: courseSelect });
  });
  res.json({ course });
}));

commerceRouter.post('/courses/:id/request', route(async (req, res) => {
  requireRole(req, 'aluno');
  const request = await db.$transaction(async tx => {
    const course = await lockedContext(tx, req, 'aluno');
    if (!course.paidContent || course.contentPriceCents < 1) throw new PlanError(400, 'Este curso não está disponível como conteúdo pago.');
    return tx.courseAccessRequest.upsert({ where: { courseId_userId: { courseId: course.id, userId: req.institution!.id } }, update: {}, create: { courseId: course.id, userId: req.institution!.id, quotedPriceCents: course.contentPriceCents }, select: { id: true, courseId: true, quotedPriceCents: true, createdAt: true } });
  });
  res.status(201).json({ request, message: 'Solicitação enviada à coordenação. Isso não confirma pagamento nem libera o acesso.' });
}));

commerceRouter.get('/courses/:id/access', route(async (req, res) => {
  requireRole(req, 'coord');
  const course = await ownCourse(req);
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length < 1 || cursor.length > 160)) throw new PlanError(400, 'Cursor de alunos inválido.');
  const records = await db.user.findMany({ where: { tenantId: req.institution!.tenantId, role: 'aluno', ...(cursor ? { id: { gt: cursor } } : {}) },
    select: { id: true, nome: true, email: true, courseId: true, courseEntitlements: { where: { courseId: course.id }, select: { active: true, reason: true } }, courseAccessRequests: { where: { courseId: course.id }, select: { quotedPriceCents: true } } },
    orderBy: { id: 'asc' }, take: 201 });
  const students = records.slice(0, 200).map(({ courseEntitlements, courseAccessRequests, courseId, ...user }) => ({ ...user,
    included: !course.paidContent && courseId === course.id,
    manualAccess: Boolean(courseEntitlements[0]?.active),
    hasAccess: Boolean(courseEntitlements[0]?.active) || (!course.paidContent && courseId === course.id),
    requested: courseAccessRequests.length > 0, quotedPriceCents: courseAccessRequests[0]?.quotedPriceCents ?? null,
    reason: courseEntitlements[0]?.reason ?? '',
  }));
  res.json({ students, nextCursor: records.length > 200 ? students[students.length - 1].id : null });
}));

commerceRouter.patch('/courses/:id/access/:userId', route(async (req, res) => {
  requireRole(req, 'coord');
  const active = req.body?.active, reason = cleanText(req.body?.reason, 1000);
  if (typeof active !== 'boolean' || !reason) throw new PlanError(400, 'Informe o acesso e uma justificativa de até 1.000 caracteres.');
  const entitlement = await db.$transaction(async tx => {
    const course = await lockedContext(tx, req, 'coord', req.params.userId);
    const target = await tx.user.findFirst({ where: { id: req.params.userId, tenantId: req.institution!.tenantId, role: 'aluno' } });
    if (!target) throw new PlanError(404, 'Aluno não encontrado nesta instituição.');
    const key = { courseId: course.id, userId: target.id };
    const previous = await tx.courseEntitlement.findUnique({ where: { courseId_userId: key }, select: { active: true } });
    const record = await tx.courseEntitlement.upsert({ where: { courseId_userId: key }, create: { ...key, active, reason, actorId: req.institution!.id }, update: { active, reason, actorId: req.institution!.id } });
    await tx.courseAccessEvent.create({ data: { ...key, actorId: req.institution!.id, action: active ? 'GRANT' : 'REVOKE', reason } });
    if (active && !previous?.active) await notifyCourseLinked(tx, { id: target.id, tenantId: req.institution!.tenantId, courseId: course.id, courseName: course.nome, targetView: target.courseId === course.id ? 'al-materias' : 'al-store' });
    if (!active && previous?.active && target.courseId !== course.id) {
      const exams = await tx.exam.findMany({ where: { courseId: course.id }, select: { id: true } });
      await tx.studentNotification.deleteMany({ where: { tenantId: req.institution!.tenantId, userId: target.id, OR: [{ kind: 'course', sourceId: course.id }, { kind: 'exam', sourceId: { in: exams.map(exam => exam.id) } }] } });
    }
    return record;
  });
  res.json({ entitlement, message: 'Acesso atualizado. A liberação manual não é uma confirmação de pagamento.' });
}));
