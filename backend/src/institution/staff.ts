import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { InstitutionRequest, institutionDb as db, requireInstitutionSession, STAFF_PERMISSIONS } from './policy';
import { PlanError } from '../controllers/plan-policy';

export const staffRouter = Router();
const select = { id: true, nome: true, email: true, permissions: true, departmentId: true, disabledAt: true } as const;
const wrap = (handler: (req: InstitutionRequest, res: Response) => Promise<unknown>) => (req: InstitutionRequest, res: Response, _next: NextFunction) => {
  Promise.resolve(handler(req, res)).catch((error: unknown) => {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    if ((error as { code?: string })?.code === 'P2002') return res.status(409).json({ error: 'Este e-mail já está em uso.' });
    res.status(503).json({ error: 'Não foi possível atualizar a equipe. Tente novamente.' });
  });
};
staffRouter.use(requireInstitutionSession);
staffRouter.use((req: InstitutionRequest, res, next) => {
  if (req.institution?.role !== 'coord' || !req.institution.tenantId) return res.status(403).json({ error: 'Somente a coordenação administra funcionários da instituição.' });
  next();
});
function profile(body: unknown) {
  const value = body as Record<string, unknown> | null;
  if (!value || typeof value.nome !== 'string' || value.nome.trim().length < 2 || value.nome.trim().length > 120 || typeof value.email !== 'string' || value.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) throw new PlanError(400, 'Informe nome e e-mail válidos.');
  if (!Array.isArray(value.permissions) || !value.permissions.every(permission => typeof permission === 'string' && STAFF_PERMISSIONS.includes(permission as typeof STAFF_PERMISSIONS[number]))) throw new PlanError(400, 'Permissões de funcionário inválidas.');
  if (value.departmentId !== null && typeof value.departmentId !== 'string') throw new PlanError(400, 'Informe um departamento válido ou nenhum departamento.');
  return { nome: value.nome.trim(), email: value.email.trim().toLowerCase(), permissions: [...new Set(value.permissions as string[])], departmentId: value.departmentId as string | null };
}
async function lockedActor(tx: Prisma.TransactionClient, req: InstitutionRequest) {
  const session = req.institution!;
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${session.tenantId} FOR UPDATE`;
  const actor = await tx.user.findFirst({ where: { id: session.id, tenantId: session.tenantId, role: 'coord', disabledAt: null, tenant: { ativo: true } } });
  if (!actor) throw new PlanError(403, 'Seu vínculo mudou. Entre novamente.');
}
async function department(tx: Prisma.TransactionClient, tenantId: string, id: string | null) {
  if (id && !await tx.department.findFirst({ where: { id, tenantId, archivedAt: null } })) throw new PlanError(400, 'Departamento não disponível nesta instituição.');
}
staffRouter.get('/', wrap(async (req, res) => {
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursor.length > 160)) throw new PlanError(400, 'Cursor inválido.');
  const users = await db.user.findMany({ where: { tenantId: req.institution!.tenantId, role: 'staff', ...(cursor ? { id: { gt: cursor } } : {}) }, select, orderBy: { id: 'asc' }, take: 201 });
  res.json({ users: users.slice(0, 200), nextCursor: users.length > 200 ? users[199].id : null });
}));
staffRouter.post('/', wrap(async (req, res) => {
  const data = profile(req.body);
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) throw new PlanError(400, 'Use senha com 8 caracteres ou mais, letra, número e caractere especial (máximo 72 bytes).');
  const hash = await bcrypt.hash(password, 12);
  const user = await db.$transaction(async tx => {
    await lockedActor(tx, req); await department(tx, req.institution!.tenantId, data.departmentId);
    return tx.user.create({ data: { ...data, password: hash, role: 'staff', papel: 'Funcionário', tenantId: req.institution!.tenantId }, select });
  });
  res.status(201).json({ user });
}));
staffRouter.patch('/:id', wrap(async (req, res) => {
  const data = profile(req.body);
  const user = await db.$transaction(async tx => {
    await lockedActor(tx, req); await department(tx, req.institution!.tenantId, data.departmentId);
    const result = await tx.user.updateMany({ where: { id: req.params.id, tenantId: req.institution!.tenantId, role: 'staff' }, data });
    if (!result.count) throw new PlanError(404, 'Funcionário não encontrado nesta instituição.');
    return tx.user.findFirst({ where: { id: req.params.id, tenantId: req.institution!.tenantId, role: 'staff' }, select });
  });
  res.json({ user });
}));
staffRouter.patch('/:id/status', wrap(async (req, res) => {
  if (typeof req.body?.active !== 'boolean') throw new PlanError(400, 'Informe o estado da conta.');
  const user = await db.$transaction(async tx => {
    await lockedActor(tx, req);
    const result = await tx.user.updateMany({ where: { id: req.params.id, tenantId: req.institution!.tenantId, role: 'staff' }, data: { disabledAt: req.body.active ? null : new Date() } });
    if (!result.count) throw new PlanError(404, 'Funcionário não encontrado nesta instituição.');
    return tx.user.findFirst({ where: { id: req.params.id, tenantId: req.institution!.tenantId, role: 'staff' }, select });
  });
  res.json({ user });
}));
