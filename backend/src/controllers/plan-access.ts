import { Prisma, PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { NextFunction, Response } from 'express';
import { PlanError, assertCapacity } from './plan-policy';
const prisma = new PrismaClient();
export type Feature = 'videoAulas' | 'provas' | 'ia';

// Resolve the current assignment and plan from the database, never from token claims.
export async function currentAccess(req: AuthRequest) {
  const user = req.user?.id ? await prisma.user.findUnique({ where: { id: req.user.id }, include: { tenant: { include: { plan: true } } } }) : null;
  if (!user) throw new PlanError(403, 'Conta não encontrada. Entre novamente.');
  if (user.disabledAt) throw new PlanError(403, 'Esta conta está desativada.');
  if (user.role !== 'superadmin' && !user.tenant?.ativo) throw new PlanError(403, 'Esta instituição não está ativa.');
  req.user = { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId || undefined, courseId: user.courseId || undefined, studentId: user.studentId || undefined, permissions: user.permissions };
  return user;
}
export async function requireFeature(req: AuthRequest, feature: Feature) {
  const user = await currentAccess(req);
  if (user.role !== 'superadmin' && user.tenant?.plan && !user.tenant.plan[feature]) throw new PlanError(403, 'Este recurso não está incluído no plano da instituição.');
  return user;
}
export const featureGate = (feature: Feature) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { await requireFeature(req, feature); next(); }
  catch (error) { return error instanceof PlanError ? res.status(error.status).json({ error: error.message }) : res.status(503).json({ error: 'Não foi possível verificar os recursos da instituição.' }); }
};
export async function countTenantStudents(tx: Prisma.TransactionClient, tenantId: string) {
  const [academic, unassigned] = await Promise.all([
    tx.student.count({ where: { course: { tenantId } } }),
    tx.user.count({ where: { tenantId, role: 'aluno', studentId: null } })
  ]);
  return academic + unassigned;
}
export async function lockTenant(tx: Prisma.TransactionClient, tenantId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
  if (!rows.length) throw new PlanError(404, 'Instituição não encontrada.');
  return tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { plan: true } });
}
export async function enforceStudentCapacity(tx: Prisma.TransactionClient, tenantId: string, additions = 1) {
  const tenant = await lockTenant(tx, tenantId);
  if (!tenant.ativo) throw new PlanError(409, 'Reative a instituição antes de cadastrar alunos.');
  const count = await countTenantStudents(tx, tenantId);
  if (tenant.plan) assertCapacity(tenant.plan.studentLimit, count, additions);
}
