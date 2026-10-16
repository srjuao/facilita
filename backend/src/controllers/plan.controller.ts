import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { assertCapacity, estimatedCents, PlanError, validatePlan } from './plan-policy';
import { countTenantStudents, lockTenant } from './plan-access';
const prisma = new PrismaClient();
const fail = (res: Response, error: unknown) => error instanceof PlanError ? res.status(error.status).json({ error: error.message }) : res.status(500).json({ error: 'Não foi possível processar o plano. Tente novamente.' });
const admin = (req: AuthRequest, res: Response) => { if (req.user?.role !== 'superadmin') { res.status(403).json({ error: 'Acesso exclusivo do superadmin.' }); return false; } return true; };
const subscription = (tenant: any) => {
  const studentCount = tenant.courses.reduce((sum: number, course: any) => sum + course._count.students, 0) + tenant._count.users;
  return { tenantId: tenant.id, nome: tenant.nome, ativo: tenant.ativo, plan: tenant.plan, studentCount, estimatedCents: estimatedCents(tenant.plan, studentCount) };
};
const includeSubscription = { plan: true, courses: { select: { _count: { select: { students: true } } } }, _count: { select: { users: { where: { role: 'aluno', studentId: null } } } } } as const;
export async function getPlans(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try { return res.json(await prisma.plan.findMany({ include: { _count: { select: { tenants: true } } }, orderBy: { createdAt: 'desc' } })); } catch (error) { return fail(res, error); }
}
export async function createPlan(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try { return res.status(201).json(await prisma.plan.create({ data: validatePlan(req.body) })); } catch (error) { return fail(res, error); }
}
export async function updatePlanStatus(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try {
    if (typeof req.body?.ativo !== 'boolean') throw new PlanError(400, 'Informe o status do plano.');
    const result = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Plan" WHERE "id" = ${req.params.id} FOR UPDATE`;
      if (!rows.length) throw new PlanError(404, 'Plano não encontrado.');
      return tx.plan.update({ where: { id: req.params.id }, data: { ativo: req.body.ativo } });
    });
    return res.json(result);
  } catch (error) { return fail(res, error); }
}
export async function getSubscriptions(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try { return res.json((await prisma.tenant.findMany({ include: includeSubscription, orderBy: { nome: 'asc' } })).map(subscription)); } catch (error) { return fail(res, error); }
}
export async function assignPlan(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try {
    const { planId, expectedPlanId } = req.body || {};
    if ((planId !== null && (typeof planId !== 'string' || !planId || planId.length > 100)) || (expectedPlanId !== null && (typeof expectedPlanId !== 'string' || !expectedPlanId || expectedPlanId.length > 100))) throw new PlanError(400, 'Informe o plano e o vínculo atual para confirmar a alteração.');
    const result = await prisma.$transaction(async tx => {
      const tenant = await lockTenant(tx, req.params.id);
      if (tenant.planId !== expectedPlanId) throw new PlanError(409, 'O plano desta instituição foi alterado por outra operação. Atualize a tela.');
      if (planId !== null) {
        const plans = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Plan" WHERE "id" = ${planId} FOR UPDATE`;
        if (!plans.length) throw new PlanError(404, 'Plano não encontrado.');
        const plan = await tx.plan.findUniqueOrThrow({ where: { id: planId } });
        if (!plan.ativo && tenant.planId !== planId) throw new PlanError(409, 'Este plano está inativo para novos vínculos.');
        assertCapacity(plan.studentLimit, await countTenantStudents(tx, tenant.id), 0);
      }
      return tx.tenant.update({ where: { id: tenant.id }, data: { planId }, include: includeSubscription });
    });
    return res.json(subscription(result));
  } catch (error) { return fail(res, error); }
}
