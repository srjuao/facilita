import { Router, Response } from 'express';
import { InstitutionRequest, institutionDb as db, requireInstitutionSession } from '../institution/policy';

export const studentNotificationRouter = Router();
studentNotificationRouter.use(requireInstitutionSession);
studentNotificationRouter.use((req: InstitutionRequest, res, next) => {
  if (req.institution?.role !== 'aluno' || !req.institution.tenantId) return res.status(403).json({ error: 'Notificações disponíveis apenas para alunos da instituição.' });
  next();
});

studentNotificationRouter.get('/', async (req: InstitutionRequest, res: Response) => {
  try {
    const where = { userId: req.institution!.id, tenantId: req.institution!.tenantId };
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    if (cursor && !await db.studentNotification.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) return res.status(400).json({ error: 'Página de notificações inválida.' });
    const [items, unreadCount] = await Promise.all([
      db.studentNotification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, kind: true, sourceId: true, title: true, body: true, targetView: true, createdAt: true, readAt: true } }),
      db.studentNotification.count({ where: { ...where, readAt: null } }),
    ]);
    return res.json({ items: items.slice(0, 50), unreadCount, nextCursor: items.length > 50 ? items[49].id : null });
  } catch { return res.status(503).json({ error: 'Não foi possível carregar as notificações.' }); }
});

studentNotificationRouter.patch('/:id/read', async (req: InstitutionRequest, res: Response) => {
  try {
    const result = await db.studentNotification.updateMany({ where: { id: req.params.id, userId: req.institution!.id, tenantId: req.institution!.tenantId, readAt: null }, data: { readAt: new Date() } });
    if (!result.count && !await db.studentNotification.findFirst({ where: { id: req.params.id, userId: req.institution!.id, tenantId: req.institution!.tenantId }, select: { id: true } })) return res.status(404).json({ error: 'Notificação não encontrada.' });
    return res.json({ read: true });
  } catch { return res.status(503).json({ error: 'Não foi possível marcar a notificação como lida.' }); }
});

studentNotificationRouter.post('/read-all', async (req: InstitutionRequest, res: Response) => {
  try {
    await db.studentNotification.updateMany({ where: { userId: req.institution!.id, tenantId: req.institution!.tenantId, readAt: null }, data: { readAt: new Date() } });
    return res.json({ read: true });
  } catch { return res.status(503).json({ error: 'Não foi possível marcar as notificações como lidas.' }); }
});
