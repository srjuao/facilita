import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { InstitutionRequest, institutionDb as db, requireInstitutionPermission } from './policy';
import { PlanError } from '../controllers/plan-policy';

export const contentManagementRouter = Router();
contentManagementRouter.use(requireInstitutionPermission('content.manage'));
const route = (handler: (req: InstitutionRequest, res: Response) => Promise<unknown>) => (req: InstitutionRequest, res: Response) => {
  Promise.resolve(handler(req, res)).catch(error => {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    res.status(503).json({ error: 'Não foi possível atualizar o conteúdo. Tente novamente.' });
  });
};
async function authorize(tx: Prisma.TransactionClient, req: InstitutionRequest, courseId: string, lock = false) {
  if (lock) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${req.user!.id} FOR UPDATE`;
  const actor = await tx.user.findUnique({ where: { id: req.user!.id }, include: { tenant: true } });
  const course = await tx.course.findUnique({ where: { id: courseId } });
  if (!actor || actor.disabledAt || !actor.tenant?.ativo || !course || actor.tenantId !== course.tenantId || !(actor.role === 'coord' || actor.role === 'professor' && actor.courseId === course.id && actor.permissions.includes('content.manage'))) throw new PlanError(403, 'Você não pode gerenciar conteúdo deste curso.');
  if (lock) {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${actor.tenantId} FOR SHARE`;
    if (!await tx.tenant.findFirst({ where: { id: actor.tenantId, ativo: true } })) throw new PlanError(403, 'Esta instituição está desativada.');
  }
  return course;
}
function version(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(new Date(value).getTime())) throw new PlanError(400, 'Atualize a tela antes de alterar este conteúdo.');
  return new Date(value);
}
function text(value: unknown, max: number, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) throw new PlanError(400, `Informe um texto válido de até ${max} caracteres.`);
  return value.trim();
}
contentManagementRouter.get('/courses/:courseId/structure', route(async (req, res) => {
  const result = await db.$transaction(async tx => {
    await authorize(tx, req, req.params.courseId);
    const [modules, periods] = await Promise.all([
      tx.module.findMany({ where: { courseId: req.params.courseId }, select: { id: true, nome: true, periodId: true, archivedAt: true, updatedAt: true, lessons: { select: { id: true, titulo: true, desc: true, prof: true, archivedAt: true, updatedAt: true }, orderBy: { titulo: 'asc' } } }, orderBy: { nome: 'asc' } }),
      tx.academicPeriod.findMany({ where: { courseId: req.params.courseId }, orderBy: { nome: 'asc' } }),
    ]);
    return { modules, periods };
  });
  res.json(result);
}));
contentManagementRouter.patch('/modules/:id', route(async (req, res) => {
  const body = req.body ?? {}, expectedUpdatedAt = version(body.expectedUpdatedAt);
  if (body.archived !== undefined && typeof body.archived !== 'boolean') throw new PlanError(400, 'Estado inválido.');
  const module = await db.$transaction(async tx => {
    const current = await tx.module.findUnique({ where: { id: req.params.id } });
    if (!current) throw new PlanError(404, 'Matéria não encontrada.');
    await authorize(tx, req, current.courseId, true);
    const periodId = body.periodId !== undefined ? body.periodId : current.periodId;
    if (periodId !== null && typeof periodId !== 'string') throw new PlanError(400, 'Período inválido.');
    if (periodId && periodId !== current.periodId && !await tx.academicPeriod.findFirst({ where: { id: periodId, courseId: current.courseId, archivedAt: null } })) throw new PlanError(400, 'Selecione um período ativo deste curso.');
    if (!periodId && body.archived !== true) throw new PlanError(400, 'Selecione um período para esta matéria.');
    const result = await tx.module.updateMany({ where: { id: current.id, updatedAt: expectedUpdatedAt }, data: {
      ...(body.nome !== undefined ? { nome: text(body.nome, 120) } : {}), ...(body.periodId !== undefined ? { periodId } : {}),
      ...(typeof body.archived === 'boolean' ? { archivedAt: body.archived ? new Date() : null } : {}),
    } });
    if (!result.count) throw new PlanError(409, 'A matéria foi alterada em outra solicitação. Atualize a tela.');
    return tx.module.findUnique({ where: { id: current.id }, select: { id: true, nome: true, periodId: true, updatedAt: true, archivedAt: true } });
  });
  res.json({ module });
}));
contentManagementRouter.patch('/lessons/:id', route(async (req, res) => {
  const body = req.body ?? {}, expectedUpdatedAt = version(body.expectedUpdatedAt);
  if (body.archived !== undefined && typeof body.archived !== 'boolean') throw new PlanError(400, 'Estado inválido.');
  const lesson = await db.$transaction(async tx => {
    const current = await tx.lesson.findUnique({ where: { id: req.params.id }, include: { module: true } });
    if (!current) throw new PlanError(404, 'Aula não encontrada.');
    await authorize(tx, req, current.module.courseId, true);
    const result = await tx.lesson.updateMany({ where: { id: current.id, updatedAt: expectedUpdatedAt }, data: {
      ...(body.titulo !== undefined ? { titulo: text(body.titulo, 200) } : {}), ...(body.desc !== undefined ? { desc: text(body.desc, 10000, false) } : {}),
      ...(typeof body.archived === 'boolean' ? { archivedAt: body.archived ? new Date() : null } : {}),
    } });
    if (!result.count) throw new PlanError(409, 'A aula foi alterada em outra solicitação. Atualize a tela.');
    return tx.lesson.findUnique({ where: { id: current.id }, select: { id: true, titulo: true, desc: true, updatedAt: true, archivedAt: true } });
  });
  res.json({ lesson });
}));
