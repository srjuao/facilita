import { Router, Response, NextFunction } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { PlanError } from '../controllers/plan-policy';
import { assertClosureReached, billingAmount, contractData, dueDate, integer } from './policy';

export const financeDb = new PrismaClient();
export const platformFinanceRouter = Router();
const wrap = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) => (req: AuthRequest, res: Response, _next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch((error: unknown) => {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    if ((error as { code?: string })?.code === 'P2002') return res.status(409).json({ error: 'Já existe uma cobrança para esta instituição e competência. Atualize a lista.' });
    res.status(503).json({ error: 'Não foi possível concluir a operação financeira. Atualize a lista antes de tentar novamente.' });
  });
};
async function actor(db: Prisma.TransactionClient, req: AuthRequest, lock = false) {
  if (!req.user?.id) throw new PlanError(401, 'Entre novamente.');
  if (lock) await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${req.user.id} FOR UPDATE`;
  const user = await db.user.findUnique({ where: { id: req.user.id }, select: { id: true, nome: true, role: true, disabledAt: true } });
  // Superadmin is platform-wide; a legacy institution link cannot revoke it.
  if (!user || user.disabledAt || user.role !== 'superadmin') throw new PlanError(403, 'Acesso exclusivo do superadmin ativo.');
  return user;
}
async function tenant(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${id} FOR UPDATE`;
  const value = await tx.tenant.findUnique({ where: { id }, select: { id: true, ativo: true, planId: true } });
  if (!value) throw new PlanError(404, 'Instituição não encontrada.');
  if (!value.ativo) throw new PlanError(409, 'Reative a instituição antes de alterar o contrato ou gerar uma cobrança.');
  return value;
}
const events = { orderBy: { createdAt: 'asc' as const } };
platformFinanceRouter.get('/', wrap(async (req, res) => {
  await actor(financeDb, req);
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursor.length > 160)) throw new PlanError(400, 'Cursor inválido.');
  const [contracts, counts, invoices] = await Promise.all([
    financeDb.platformContract.findMany({ include: { tenant: { select: { id: true, nome: true, ativo: true } } }, orderBy: { billingName: 'asc' } }),
    financeDb.user.groupBy({ by: ['tenantId'], where: { role: 'aluno', disabledAt: null, tenantId: { not: null } }, _count: { id: true } }),
    financeDb.platformInvoice.findMany({ where: cursor ? { id: { lt: cursor as string } } : {}, include: { events }, orderBy: { id: 'desc' }, take: 101 }),
  ]);
  res.json({ contracts: contracts.map(item => ({ ...item, activeStudents: counts.find(count => count.tenantId === item.tenantId)?._count.id ?? 0 })), invoices: invoices.slice(0, 100), nextCursor: invoices.length > 100 ? invoices[99].id : null });
}));
platformFinanceRouter.put('/contracts/:tenantId', wrap(async (req, res) => {
  await actor(financeDb, req);
  const data = contractData(req.body ?? {});
  const expected = req.body?.expectedVersion;
  if (expected !== null) integer(expected, 'Versão do contrato');
  const contract = await financeDb.$transaction(async tx => {
    const currentActor = await actor(tx, req, true); await tenant(tx, req.params.tenantId);
    const current = await tx.platformContract.findUnique({ where: { tenantId: req.params.tenantId } });
    if ((current?.version ?? null) !== expected) throw new PlanError(409, 'O contrato foi alterado. Atualize antes de salvar.');
    return current ? tx.platformContract.update({ where: { tenantId: current.tenantId }, data: { ...data, updatedBy: currentActor.id, version: { increment: 1 } } }) : tx.platformContract.create({ data: { ...data, tenantId: req.params.tenantId, updatedBy: currentActor.id } });
  });
  res.json({ contract });
}));
platformFinanceRouter.post('/invoices', wrap(async (req, res) => {
  await actor(financeDb, req);
  const { tenantId, competence, expectedContractVersion } = req.body ?? {};
  if (typeof tenantId !== 'string' || !tenantId || tenantId.length > 160) throw new PlanError(400, 'Instituição inválida.');
  integer(expectedContractVersion, 'Versão do contrato'); dueDate(competence, 1);
  const invoice = await financeDb.$transaction(async tx => {
    const currentActor = await actor(tx, req, true); const currentTenant = await tenant(tx, tenantId);
    if (!currentTenant.planId) throw new PlanError(409, 'Vincule um plano e confirme o contrato antes de emitir a cobrança.');
    const contract = await tx.platformContract.findUnique({ where: { tenantId } });
    if (!contract) throw new PlanError(409, 'Cadastre o contrato antes de emitir uma cobrança.');
    if (contract.version !== expectedContractVersion) throw new PlanError(409, 'O contrato mudou. Atualize e revise os valores antes de emitir.');
    if (await tx.platformInvoice.findUnique({ where: { tenantId_competence: { tenantId, competence } } })) throw new PlanError(409, 'Já existe uma cobrança nesta competência, inclusive se cancelada.');
    const closingDate = assertClosureReached(competence, contract.closingDay);
    const activeStudents = await tx.user.count({ where: { tenantId, role: 'aluno', disabledAt: null } });
    const { tenantId: _tenant, version, updatedBy: _actor, createdAt: _created, updatedAt: _updated, dueDay, ...snapshot } = contract;
    return tx.platformInvoice.create({ data: { ...snapshot, tenantId, competence, number: `FAT-${competence.replace('-', '')}-${randomUUID().toUpperCase()}`, closingDate, dueDate: dueDate(competence, dueDay, contract.closingDay), contractVersion: version, activeStudents, ...billingAmount(contract.minimumStudents, activeStudents, contract.unitCents), events: { create: { action: 'CREATED', note: 'Fatura interna emitida, sem registro bancário ou envio automático.', actorId: currentActor.id, actorName: currentActor.nome } } }, include: { events } });
  });
  res.status(201).json({ invoice });
}));
platformFinanceRouter.patch('/invoices/:id/status', wrap(async (req, res) => {
  await actor(financeDb, req);
  const { status, note, expectedVersion } = req.body ?? {};
  if (!['PAID', 'CANCELLED'].includes(status) || typeof note !== 'string' || note.trim().length < 3 || note.trim().length > 1000) throw new PlanError(400, 'Informe a ação e uma justificativa ou referência de pagamento (3 a 1000 caracteres).');
  integer(expectedVersion, 'Versão da cobrança');
  const invoice = await financeDb.$transaction(async tx => {
    const currentActor = await actor(tx, req, true);
    await tx.$queryRaw`SELECT "id" FROM "PlatformInvoice" WHERE "id" = ${req.params.id} FOR UPDATE`;
    const current = await tx.platformInvoice.findUnique({ where: { id: req.params.id } });
    if (!current) throw new PlanError(404, 'Cobrança não encontrada.');
    if (current.version !== expectedVersion || current.status !== 'OPEN') throw new PlanError(409, 'A cobrança já foi alterada ou encerrada. Atualize a lista.');
    return tx.platformInvoice.update({ where: { id: current.id }, data: { status, paidAt: status === 'PAID' ? new Date() : null, version: { increment: 1 }, events: { create: { action: status, note: note.trim(), actorId: currentActor.id, actorName: currentActor.nome } } }, include: { events } });
  });
  res.json({ invoice });
}));
