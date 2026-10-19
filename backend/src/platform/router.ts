import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';

const db = new PrismaClient();
export const platformRouter = Router();
export const institutionSupportRouter = Router();
const scopes = ['platform.support', 'platform.finance', 'platform.sales'] as const;
type Scope = typeof scopes[number];
type Actor = { id: string; role: string; tenantId: string | null; permissions: string[]; disabledAt: Date | null };
async function actor(req: AuthRequest, scope?: Scope): Promise<Actor | null> {
  if (!req.user?.id) return null;
  const account = await db.user.findUnique({ where: { id: req.user.id }, select: { id: true, role: true, tenantId: true, permissions: true, disabledAt: true } });
  if (!account || account.disabledAt || !['superadmin', 'platform_staff'].includes(account.role) || account.role === 'platform_staff' && account.tenantId) return null;
  if (scope && account.role !== 'superadmin' && !account.permissions.includes(scope)) return null;
  return account;
}
const fail = (res: Response) => res.status(403).json({ error: 'Sua conta não tem acesso a esta área da plataforma.' });
const wrap = (handler: (req: AuthRequest, res: Response) => Promise<void | Response>) => (req: AuthRequest, res: Response) => {
  void handler(req, res).catch((error: unknown) => { if (!res.headersSent) res.status((error as { code?: string })?.code === 'P2002' ? 409 : 503).json({ error: (error as { code?: string })?.code === 'P2002' ? 'Este e-mail já está cadastrado.' : 'Não foi possível concluir a operação. Tente novamente.' }); });
};
const validEmail = (email: unknown) => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = (value: unknown) => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

async function institutionActor(req: AuthRequest) {
  if (!req.user?.id) return null;
  const account = await db.user.findUnique({ where: { id: req.user.id }, select: { id: true, role: true, tenantId: true, permissions: true, disabledAt: true, tenant: { select: { ativo: true } } } });
  if (!account || account.disabledAt || !account.tenantId || !account.tenant?.ativo || account.role !== 'coord' && !(account.role === 'staff' && account.permissions.includes('support.manage'))) return null;
  return account;
}

institutionSupportRouter.get('/', wrap(async (req, res) => {
  const current = await institutionActor(req); if (!current) return fail(res);
  const tickets = await db.platformTicket.findMany({ where: { tenantId: current.tenantId! }, include: { openedBy: { select: { nome: true } }, messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { nome: true, role: true } } } } }, orderBy: { updatedAt: 'desc' }, take: 100 });
  res.json(tickets);
}));
institutionSupportRouter.post('/', wrap(async (req, res) => {
  const current = await institutionActor(req); if (!current) return fail(res);
  const { subject, body } = req.body ?? {};
  if (typeof subject !== 'string' || subject.trim().length < 5 || subject.trim().length > 160 || typeof body !== 'string' || body.trim().length < 10 || body.trim().length > 4000) return res.status(400).json({ error: 'Informe assunto (5–160 caracteres) e descrição (10–4.000 caracteres).' });
  const ticket = await db.platformTicket.create({ data: { tenantId: current.tenantId!, openedById: current.id, subject: subject.trim(), messages: { create: { authorId: current.id, body: body.trim() } } } });
  res.status(201).json(ticket);
}));
institutionSupportRouter.post('/:id/reply', wrap(async (req, res) => {
  const current = await institutionActor(req); if (!current) return fail(res);
  const body = req.body?.body;
  if (typeof body !== 'string' || body.trim().length < 2 || body.trim().length > 4000) return res.status(400).json({ error: 'Escreva uma resposta de 2 a 4.000 caracteres.' });
  const ticket = await db.platformTicket.findFirst({ where: { id: req.params.id, tenantId: current.tenantId! } });
  if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado.' });
  const message = await db.$transaction(async tx => { const created = await tx.platformTicketMessage.create({ data: { ticketId: ticket.id, authorId: current.id, body: body.trim() }, include: { author: { select: { nome: true, role: true } } } }); await tx.platformTicket.update({ where: { id: ticket.id }, data: { status: 'OPEN' } }); return created; });
  res.status(201).json(message);
}));

platformRouter.get('/team', wrap(async (req, res) => {
  const current = await actor(req); if (!current || current.role !== 'superadmin') return fail(res);
  const users = await db.user.findMany({ where: { OR: [{ role: 'superadmin' }, { role: 'platform_staff', tenantId: null }] }, select: { id: true, nome: true, email: true, role: true, permissions: true, disabledAt: true }, orderBy: { nome: 'asc' } });
  res.json(users);
}));
platformRouter.get('/overview', wrap(async (req, res) => {
  const current = await actor(req); if (!current || current.role !== 'superadmin') return fail(res);
  const [openTickets, newLeads, openInvoices, staff] = await Promise.all([
    db.platformTicket.count({ where: { status: { not: 'RESOLVED' } } }),
    db.lead.count({ where: { stage: 'NOVO' } }),
    db.platformInvoice.count({ where: { status: 'OPEN' } }),
    db.user.count({ where: { role: 'platform_staff', disabledAt: null, tenantId: null } }),
  ]);
  res.json({ openTickets, newLeads, openInvoices, staff });
}));
platformRouter.post('/team', wrap(async (req, res) => {
  const current = await actor(req); if (!current || current.role !== 'superadmin') return fail(res);
  const { nome, email, password, permissions, role } = req.body ?? {};
  if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 120 || !validEmail(email) || !validPassword(password) || !['platform_staff', 'superadmin'].includes(role) || !Array.isArray(permissions) || permissions.some(value => !scopes.includes(value))) return res.status(400).json({ error: 'Informe nome, e-mail, perfil e senha de 8 caracteres ou mais com letra, número e caractere especial.' });
  if (role === 'platform_staff' && !permissions.length) return res.status(400).json({ error: 'Selecione ao menos uma área para esta conta.' });
  const normalizedEmail = email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email: normalizedEmail } })) return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({ data: { nome: nome.trim(), email: normalizedEmail, password: passwordHash, papel: role === 'superadmin' ? 'Administrador geral' : 'Equipe Facilita', role, permissions: role === 'superadmin' ? [] : permissions }, select: { id: true, nome: true, email: true, role: true, permissions: true, disabledAt: true } });
  res.status(201).json(user);
}));
platformRouter.patch('/team/:id', wrap(async (req, res) => {
  const current = await actor(req); if (!current || current.role !== 'superadmin') return fail(res);
  const { nome, permissions, disabled, password } = req.body ?? {};
  const target = await db.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true, tenantId: true, disabledAt: true } });
  if (!target || !['superadmin', 'platform_staff'].includes(target.role) || target.role === 'platform_staff' && target.tenantId) return res.status(404).json({ error: 'Conta da plataforma não encontrada.' });
  if (target.id === current.id && disabled === true) return res.status(409).json({ error: 'Você não pode desativar a própria conta.' });
  if (nome !== undefined && (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 120)) return res.status(400).json({ error: 'Nome inválido.' });
  if (permissions !== undefined && (!Array.isArray(permissions) || permissions.some(value => !scopes.includes(value)) || target.role === 'platform_staff' && !permissions.length)) return res.status(400).json({ error: 'Selecione áreas válidas para esta conta.' });
  if (disabled !== undefined && typeof disabled !== 'boolean') return res.status(400).json({ error: 'Situação inválida.' });
  if (password !== undefined && !validPassword(password)) return res.status(400).json({ error: 'A nova senha precisa de 8 caracteres ou mais, com letra, número e caractere especial.' });
  const data = { ...(nome !== undefined ? { nome: nome.trim() } : {}), ...(permissions !== undefined && target.role === 'platform_staff' ? { permissions } : {}), ...(disabled !== undefined ? { disabledAt: disabled ? new Date() : null } : {}), ...(password !== undefined ? { password: await bcrypt.hash(password, 12) } : {}) };
  const updated = await db.$transaction(async tx => {
    // Serialize owner changes so two administrators cannot deactivate each other simultaneously.
    if (target.role === 'superadmin' && disabled === true) {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "role" = 'superadmin' AND "disabledAt" IS NULL FOR UPDATE`;
      if (await tx.user.count({ where: { role: 'superadmin', disabledAt: null } }) <= 1) return null;
    }
    return tx.user.update({ where: { id: target.id }, data, select: { id: true, nome: true, email: true, role: true, permissions: true, disabledAt: true } });
  });
  if (!updated) return res.status(409).json({ error: 'A última conta de administrador geral não pode ser desativada.' });
  res.json(updated);
}));

platformRouter.get('/tickets', wrap(async (req, res) => {
  if (!await actor(req, 'platform.support')) return fail(res);
  const tickets = await db.platformTicket.findMany({ include: { tenant: { select: { nome: true, dominio: true } }, openedBy: { select: { nome: true, email: true } }, messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { nome: true, role: true } } } } }, orderBy: { updatedAt: 'desc' }, take: 200 });
  res.json(tickets);
}));
platformRouter.post('/tickets/:id/reply', wrap(async (req, res) => {
  const current = await actor(req, 'platform.support'); if (!current) return fail(res);
  const body = req.body?.body;
  if (typeof body !== 'string' || body.trim().length < 2 || body.trim().length > 4000) return res.status(400).json({ error: 'Escreva uma resposta de 2 a 4.000 caracteres.' });
  const ticket = await db.platformTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado.' });
  const message = await db.$transaction(async tx => { const created = await tx.platformTicketMessage.create({ data: { ticketId: ticket.id, authorId: current.id, body: body.trim() }, include: { author: { select: { nome: true, role: true } } } }); await tx.platformTicket.update({ where: { id: ticket.id }, data: { status: 'WAITING_INSTITUTION' } }); return created; });
  res.status(201).json(message);
}));
platformRouter.patch('/tickets/:id', wrap(async (req, res) => {
  if (!await actor(req, 'platform.support')) return fail(res);
  const { status, priority } = req.body ?? {};
  if (status !== undefined && !['OPEN', 'IN_PROGRESS', 'WAITING_INSTITUTION', 'RESOLVED'].includes(status) || priority !== undefined && !['LOW', 'NORMAL', 'HIGH'].includes(priority)) return res.status(400).json({ error: 'Situação ou prioridade inválida.' });
  const result = await db.platformTicket.updateMany({ where: { id: req.params.id }, data: { ...(status !== undefined ? { status } : {}), ...(priority !== undefined ? { priority } : {}) } });
  if (!result.count) return res.status(404).json({ error: 'Chamado não encontrado.' });
  res.json({ message: 'Chamado atualizado.' });
}));

platformRouter.get('/audit', wrap(async (req, res) => {
  const current = await actor(req); if (!current || current.role !== 'superadmin') return fail(res);
  const logs = await db.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(logs);
}));
