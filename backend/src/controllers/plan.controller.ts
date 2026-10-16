import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { assertCapacity, estimatedCents, PlanError, validatePlan } from './plan-policy';
import { countTenantStudents, lockTenant } from './plan-access';
import { billingAmount, contractData, integer } from '../platform-finance/policy';
const prisma = new PrismaClient();
const fail = (res: Response, error: unknown) => error instanceof PlanError ? res.status(error.status).json({ error: error.message }) : res.status(500).json({ error: 'Não foi possível processar o plano. Tente novamente.' });
const admin = (req: AuthRequest, res: Response) => { if (req.user?.role !== 'superadmin') { res.status(403).json({ error: 'Acesso exclusivo do superadmin.' }); return false; } return true; };
const subscription = (tenant: any, activeStudentAccounts: number) => {
  const studentCount = tenant.courses.reduce((sum: number, course: any) => sum + course._count.students, 0) + tenant._count.users;
  const billingContract = tenant.billingContract ?? null;
  const billableStudents = billingContract ? Math.max(billingContract.minimumStudents, activeStudentAccounts) : 0;
  const contractEstimatedCents = tenant.plan && billingContract && billableStudents * billingContract.unitCents <= 2147483647
    ? billingAmount(billingContract.minimumStudents, activeStudentAccounts, billingContract.unitCents).totalCents : null;
  return { tenantId: tenant.id, nome: tenant.nome, ativo: tenant.ativo, plan: tenant.plan, billingContract, studentCount, activeStudentAccounts, estimatedCents: estimatedCents(tenant.plan, studentCount), contractEstimatedCents };
};
const pointsInclude = { pricePoints: { orderBy: { students: 'asc' as const } } };
const includeSubscription = { plan: { include: pointsInclude }, billingContract: true, courses: { select: { _count: { select: { students: true } } } }, _count: { select: { users: { where: { role: 'aluno', studentId: null } } } } } as const;
async function currentAdmin(db: any, req: AuthRequest) {
  if (!req.user?.id) throw new PlanError(401, 'Entre novamente.');
  const current = await db.user.findUnique({ where: { id: req.user.id }, select: { id: true, role: true, disabledAt: true } });
  if (!current || current.disabledAt || current.role !== 'superadmin') throw new PlanError(403, 'Acesso exclusivo do superadmin ativo.');
  return current;
}
export async function getPlans(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try { return res.json(await prisma.plan.findMany({ include: { ...pointsInclude, _count: { select: { tenants: true } } }, orderBy: { createdAt: 'desc' } })); } catch (error) { return fail(res, error); }
}
export async function createPlan(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try { return res.status(201).json(await prisma.plan.create({ data: validatePlan(req.body), include: pointsInclude })); } catch (error) { return fail(res, error); }
}
export async function updatePlanStatus(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try {
    if (typeof req.body?.ativo !== 'boolean') throw new PlanError(400, 'Informe o status do plano.');
    const result = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Plan" WHERE "id" = ${req.params.id} FOR UPDATE`;
      if (!rows.length) throw new PlanError(404, 'Plano não encontrado.');
      if (!req.body.ativo && await tx.publicPricingSetting.findFirst({ where: { planId: req.params.id } })) throw new PlanError(409, 'Selecione outro plano para a landing page antes de desativar este.');
      return tx.plan.update({ where: { id: req.params.id }, data: { ativo: req.body.ativo }, include: pointsInclude });
    });
    return res.json(result);
  } catch (error) { return fail(res, error); }
}
export async function getSubscriptions(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try {
    await currentAdmin(prisma, req);
    const [tenants, counts] = await Promise.all([
      prisma.tenant.findMany({ include: includeSubscription, orderBy: { nome: 'asc' } }),
      prisma.user.groupBy({ by: ['tenantId'], where: { role: 'aluno', disabledAt: null, tenantId: { not: null } }, _count: { id: true } }),
    ]);
    const countByTenant = new Map(counts.map(item => [item.tenantId, item._count.id]));
    return res.json(tenants.map(item => subscription(item, countByTenant.get(item.id) ?? 0)));
  } catch (error) { return fail(res, error); }
}
export async function assignPlan(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try {
    const { planId, expectedPlanId, billingContract, expectedContractVersion } = req.body || {};
    if ((planId !== null && (typeof planId !== 'string' || !planId || planId.length > 100)) || (expectedPlanId !== null && (typeof expectedPlanId !== 'string' || !expectedPlanId || expectedPlanId.length > 100))) throw new PlanError(400, 'Informe o plano e o vínculo atual para confirmar a alteração.');
    if (planId === null && (billingContract !== undefined || expectedContractVersion !== undefined)) throw new PlanError(400, 'Remova o plano sem alterar os dados do contrato.');
    if (planId !== null) {
      if (!billingContract || typeof billingContract !== 'object' || Array.isArray(billingContract)) throw new PlanError(400, 'Preencha os dados de cobrança antes de vincular o plano.');
      if (expectedContractVersion !== null) integer(expectedContractVersion, 'Versão do contrato');
    }
    const contract = planId === null ? null : contractData(billingContract);
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${req.user!.id} FOR UPDATE`;
      const actor = await currentAdmin(tx, req);
      const tenant = await lockTenant(tx, req.params.id);
      if (tenant.planId !== expectedPlanId) throw new PlanError(409, 'O plano desta instituição foi alterado por outra operação. Atualize a tela.');
      const currentContract = await tx.platformContract.findUnique({ where: { tenantId: tenant.id } });
      if (planId !== null && (currentContract?.version ?? null) !== expectedContractVersion) throw new PlanError(409, 'O contrato foi alterado. Atualize antes de salvar.');
      if (planId !== null) {
        const plans = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Plan" WHERE "id" = ${planId} FOR UPDATE`;
        if (!plans.length) throw new PlanError(404, 'Plano não encontrado.');
        const plan = await tx.plan.findUniqueOrThrow({ where: { id: planId } });
        if (!plan.ativo && tenant.planId !== planId) throw new PlanError(409, 'Este plano está inativo para novos vínculos.');
        if (plan.billingMode === 'FIXO') throw new PlanError(400, 'Este plano usa preço fixo e não é compatível com cobrança por aluno. Selecione um plano por aluno ou faixas.');
        if (plan.studentLimit !== null && contract!.minimumStudents > plan.studentLimit) throw new PlanError(400, 'O mínimo contratado ultrapassa o limite de alunos deste plano.');
        assertCapacity(plan.studentLimit, await countTenantStudents(tx, tenant.id), 0);
        if (currentContract) await tx.platformContract.update({ where: { tenantId: tenant.id }, data: { ...contract!, updatedBy: actor.id, version: { increment: 1 } } });
        else await tx.platformContract.create({ data: { ...contract!, tenantId: tenant.id, updatedBy: actor.id } });
      }
      const updated = await tx.tenant.update({ where: { id: tenant.id }, data: { planId }, include: includeSubscription });
      const activeStudentAccounts = await tx.user.count({ where: { tenantId: tenant.id, role: 'aluno', disabledAt: null } });
      return subscription(updated, activeStudentAccounts);
    });
    return res.json(result);
  } catch (error) { return fail(res, error); }
}

export async function getPublicPricing(_req: AuthRequest, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const setting = await prisma.publicPricingSetting.findUnique({ where: { id: 1 }, include: { plan: { include: pointsInclude } } });
    const plan = setting?.plan;
    if (!plan || !plan.ativo || plan.billingMode !== 'FAIXAS' || plan.studentLimit !== null || plan.pricePoints.length < 2) throw new PlanError(503, 'A simulação de preços está temporariamente indisponível. Entre em contato.');
    return res.json({ planId: plan.id, nome: plan.nome, pricePoints: plan.pricePoints.map(({ students, unitCents }) => ({ students, unitCents })), studentLimit: plan.studentLimit });
  } catch (error) { return fail(res, error); }
}
export async function getPricingSetting(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try { return res.json({ planId: (await prisma.publicPricingSetting.findUnique({ where: { id: 1 } }))?.planId ?? null }); }
  catch (error) { return fail(res, error); }
}
export async function updatePricingSetting(req: AuthRequest, res: Response) {
  if (!admin(req, res)) return;
  try {
    const { planId, expectedPlanId } = req.body || {};
    if (typeof planId !== 'string' || !planId || planId.length > 100 || (expectedPlanId !== null && (typeof expectedPlanId !== 'string' || !expectedPlanId || expectedPlanId.length > 100))) throw new PlanError(400, 'Informe o plano e a seleção atual da landing page.');
    const setting = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "PublicPricingSetting" WHERE "id" = 1 FOR UPDATE`;
      const current = await tx.publicPricingSetting.findUnique({ where: { id: 1 } });
      if (!current) throw new PlanError(503, 'A configuração pública de preços ainda não foi instalada.');
      if (current.planId !== expectedPlanId) throw new PlanError(409, 'O plano público foi alterado por outra operação. Atualize a tela.');
      await tx.$queryRaw`SELECT "id" FROM "Plan" WHERE "id" = ${planId} FOR UPDATE`;
      const plan = await tx.plan.findUnique({ where: { id: planId }, include: pointsInclude });
      if (!plan || !plan.ativo || plan.billingMode !== 'FAIXAS' || plan.studentLimit !== null || plan.pricePoints.length < 2) throw new PlanError(400, 'Selecione um plano ativo por faixas e sem limite de alunos para a landing page.');
      return tx.publicPricingSetting.update({ where: { id: 1 }, data: { planId } });
    });
    return res.json({ planId: setting.planId });
  } catch (error) { return fail(res, error); }
}
