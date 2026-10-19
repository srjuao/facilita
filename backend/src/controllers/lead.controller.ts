import { Prisma, PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { LeadRateLimiter, validateLeadUpdate, validatePublicLead } from './lead-validation';

const prisma = new PrismaClient();
const limiter = new LeadRateLimiter();
const acknowledgment = { message: 'Recebemos seu contato. Nossa equipe retornará em breve.' };
async function canManageLeads(req: AuthRequest) {
  if (!req.user?.id) return false;
  const account = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true, permissions: true, tenantId: true, disabledAt: true } });
  return !!account && !account.disabledAt && (account.role === 'superadmin' || account.role === 'platform_staff' && !account.tenantId && account.permissions.includes('platform.sales'));
}

export const createPublicLead = async (req: Request, res: Response) => {
  // This app is behind a proxy, so the shared socket IP budget is intentionally generous.
  // The email-specific budget provides a narrower cap without trusting spoofable headers.
  if (!limiter.allow(`ip:${req.socket.remoteAddress ?? 'unknown'}`, 120, 10 * 60 * 1000)) return res.status(429).json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' });
  if (typeof req.body?.website === 'string' && req.body.website.trim()) return res.status(202).json(acknowledgment);
  const validated = validatePublicLead(req.body);
  if ('error' in validated) return res.status(400).json({ error: validated.error });
  if (!limiter.allow(`email:${validated.data.email}`, 3, 60 * 60 * 1000)) return res.status(429).json({ error: 'Já recebemos solicitações deste e-mail. Aguarde antes de tentar novamente.' });
  try {
    await prisma.lead.create({ data: validated.data });
    return res.status(201).json(acknowledgment);
  } catch {
    return res.status(503).json({ error: 'Não foi possível enviar seu contato. Tente novamente em instantes.' });
  }
};

export const getLeads = async (req: AuthRequest, res: Response) => {
  if (!await canManageLeads(req)) return res.status(403).json({ error: 'Acesso exclusivo do comercial da plataforma.' });
  const query = req.query ?? {};
  if ((query.q !== undefined && typeof query.q !== 'string') || (query.cursor !== undefined && typeof query.cursor !== 'string')) return res.status(400).json({ error: 'Busca ou página inválida.' });
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const cursor = typeof query.cursor === 'string' ? query.cursor.trim() : '';
  if (q.length > 200 || cursor.length > 128 || (query.cursor !== undefined && !cursor)) return res.status(400).json({ error: 'Busca ou página inválida.' });
  const where: Prisma.LeadWhereInput = q ? { OR: ['nome', 'instituicao', 'email', 'telefone'].map(field => ({ [field]: { contains: q, mode: 'insensitive' } })) } : {};
  try {
    const [rows, total] = await prisma.$transaction([
      prisma.lead.findMany({ where, take: 101, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
      prisma.lead.count({ where })
    ]);
    const items = rows.slice(0, 100);
    return res.json({ items, total, nextCursor: rows.length > 100 ? items[items.length - 1].id : null });
  } catch {
    return res.status(503).json({ error: 'Não foi possível carregar os leads.' });
  }
};

export const updateLead = async (req: AuthRequest, res: Response) => {
  if (!await canManageLeads(req)) return res.status(403).json({ error: 'Acesso exclusivo do comercial da plataforma.' });
  if (!req.params.id || req.params.id.length > 128) return res.status(400).json({ error: 'Lead inválido.' });
  const validated = validateLeadUpdate(req.body);
  if ('error' in validated) return res.status(400).json({ error: validated.error });
  try {
    const result = await prisma.$transaction(async tx => {
      // Always advance the version, including two edits within the same millisecond.
      const updatedAt = new Date(Math.max(Date.now(), validated.expectedUpdatedAt.getTime() + 1));
      const changed = await tx.lead.updateMany({ where: { id: req.params.id, updatedAt: validated.expectedUpdatedAt }, data: { ...validated.data, updatedAt } });
      const lead = await tx.lead.findUnique({ where: { id: req.params.id } });
      return { changed: changed.count, lead };
    });
    if (!result.lead) return res.status(404).json({ error: 'Lead não encontrado.' });
    if (!result.changed) return res.status(409).json({ error: 'Este lead foi atualizado em outra sessão. Recarregue para não sobrescrever alterações.' });
    return res.json(result.lead);
  } catch {
    return res.status(503).json({ error: 'Não foi possível salvar o lead. Tente novamente.' });
  }
};
