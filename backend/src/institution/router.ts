import { Router, Response, NextFunction } from 'express';
import { InstitutionRequest, requireInstitutionSession, institutionDb as db, PERMISSIONS, effectivePermissions, cleanText, cleanMembers } from './policy';

export const institutionRouter = Router();
export { requireInstitutionPermission, requireInstitutionSession } from './policy';
const route = (handler: (req: InstitutionRequest, res: Response) => Promise<unknown>) => (req: InstitutionRequest, res: Response, _next: NextFunction) => {
  Promise.resolve(handler(req, res)).catch((error: { code?: string }) => {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Já existe um registro com esse nome nesta instituição.' });
    res.status(500).json({ error: 'Não foi possível concluir esta ação. Tente novamente.' });
  });
};
institutionRouter.use(requireInstitutionSession);
institutionRouter.use((req: InstitutionRequest, res, next) => {
  if (!req.institution?.tenantId || req.institution.role === 'superadmin') return res.status(403).json({ error: 'Acesse com uma conta vinculada à instituição.' });
  next();
});
const allow = (req: InstitutionRequest, res: Response, permission: string) => {
  if (req.institution!.permissions.includes(permission)) return true;
  res.status(403).json({ error: 'A coordenação não concedeu permissão para esta ação.' });
  return false;
};
const coord = (req: InstitutionRequest, res: Response) => {
  if (req.institution!.role === 'coord') return true;
  res.status(403).json({ error: 'Somente a coordenação pode gerenciar a equipe e os departamentos.' });
  return false;
};
const courseAllowed = async (req: InstitutionRequest, courseId: unknown) => typeof courseId === 'string'
  && (req.institution!.role === 'coord' || req.institution!.courseId === courseId)
  && Boolean(await db.course.findFirst({ where: { id: courseId, tenantId: req.institution!.tenantId } }));

institutionRouter.get('/access', route(async (req, res) => res.json({ permissions: req.institution!.permissions })));
institutionRouter.get('/directory', route(async (req, res) => {
  const tenantId = req.institution!.tenantId;
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor.length || cursor.length > 160)) return res.status(400).json({ error: 'Cursor de usuários inválido.' });
  const where = { tenantId, role: { in: ['coord', 'professor', 'aluno'] } };
  const [records, totalUsers, departments, courses] = await Promise.all([
    db.user.findMany({ where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) }, select: { id: true, nome: true, email: true, role: true, departmentId: true, permissions: true, courseId: true }, orderBy: { id: 'asc' }, take: 201 }),
    db.user.count({ where }),
    db.department.findMany({ where: { tenantId }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    db.course.findMany({ where: { tenantId }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ]);
  const users = records.slice(0, 200);
  res.json({ users: req.institution!.role === 'coord' ? users.map(user => ({ ...user, permissions: effectivePermissions(user.role, user.permissions) })) : users.map(({ id, nome, role, courseId, departmentId }) => ({ id, nome, role, courseId, departmentId })), departments, courses, totalUsers, nextCursor: records.length > 200 ? users[users.length - 1].id : null });
}));
institutionRouter.patch('/users/:id/access', route(async (req, res) => {
  if (!coord(req, res)) return;
  const tenantId = req.institution!.tenantId;
  const target = await db.user.findFirst({ where: { id: req.params.id, tenantId, role: { in: ['professor', 'aluno'] } } });
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado nesta instituição.' });
  const { permissions, departmentId } = req.body;
  if (!Array.isArray(permissions) || !permissions.every(value => typeof value === 'string' && PERMISSIONS.includes(value as typeof PERMISSIONS[number])) || (departmentId !== null && typeof departmentId !== 'string')) return res.status(400).json({ error: 'Permissões ou departamento inválidos.' });
  if (target.role !== 'professor' && permissions.length) return res.status(400).json({ error: 'Alunos não podem receber permissões administrativas.' });
  if (departmentId && !await db.department.findFirst({ where: { id: departmentId, tenantId } })) return res.status(400).json({ error: 'Departamento não encontrado nesta instituição.' });
  const updated = await db.user.updateMany({ where: { id: target.id, tenantId, role: target.role }, data: { permissions: [...new Set(permissions)] as string[], departmentId } });
  if (!updated.count) return res.status(409).json({ error: 'O vínculo deste usuário foi alterado. Atualize a lista e tente novamente.' });
  const user = await db.user.findFirst({ where: { id: target.id, tenantId, role: target.role }, select: { id: true, nome: true, role: true, permissions: true, departmentId: true } });
  if (!user) return res.status(409).json({ error: 'O vínculo deste usuário foi alterado. Atualize a lista e tente novamente.' });
  res.json(user);
}));
institutionRouter.post('/departments', route(async (req, res) => {
  if (!coord(req, res)) return;
  const nome = cleanText(req.body.nome, 100);
  if (!nome) return res.status(400).json({ error: 'Informe o nome do departamento (até 100 caracteres).' });
  res.status(201).json(await db.department.create({ data: { nome, tenantId: req.institution!.tenantId } }));
}));
institutionRouter.get('/notices', route(async (req, res) => res.json(await db.announcement.findMany({ where: { tenantId: req.institution!.tenantId }, include: { author: { select: { id: true, nome: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }))));
institutionRouter.post('/notices', route(async (req, res) => {
  if (!allow(req, res, 'notices.manage')) return;
  const title = cleanText(req.body.title, 160), body = cleanText(req.body.body, 10000);
  if (!title || !body) return res.status(400).json({ error: 'Informe título (até 160 caracteres) e aviso (até 10.000 caracteres).' });
  res.status(201).json(await db.announcement.create({ data: { title, body, tenantId: req.institution!.tenantId, createdBy: req.institution!.id }, include: { author: { select: { id: true, nome: true } } } }));
}));
institutionRouter.get('/periods', route(async (req, res) => {
  const session = req.institution!;
  res.json(await db.academicPeriod.findMany({ where: { tenantId: session.tenantId, ...(session.role === 'coord' ? {} : { courseId: session.courseId ?? '' }) }, include: { course: { select: { id: true, nome: true } }, _count: { select: { modules: true } } }, orderBy: { nome: 'asc' } }));
}));
institutionRouter.post('/periods', route(async (req, res) => {
  if (!allow(req, res, 'content.manage')) return;
  const nome = cleanText(req.body.nome, 100);
  if (!nome || !await courseAllowed(req, req.body.courseId)) return res.status(400).json({ error: 'Informe um nome e um curso autorizado para este período.' });
  res.status(201).json(await db.academicPeriod.create({ data: { nome, courseId: req.body.courseId, tenantId: req.institution!.tenantId } }));
}));
institutionRouter.get('/classes', route(async (req, res) => {
  const session = req.institution!;
  res.json(await db.classGroup.findMany({ where: { tenantId: session.tenantId, ...(session.role === 'aluno' ? { memberIds: { has: session.id } } : session.role === 'professor' ? { courseId: session.courseId ?? '' } : {}) }, include: { course: { select: { id: true, nome: true } } }, orderBy: { nome: 'asc' } }));
}));
institutionRouter.post('/classes', route(async (req, res) => {
  if (!allow(req, res, 'classes.manage')) return;
  const nome = cleanText(req.body.nome, 100), memberIds = cleanMembers(req.body.memberIds);
  if (!nome || !memberIds || !await courseAllowed(req, req.body.courseId)) return res.status(400).json({ error: 'Informe nome, curso e participantes válidos.' });
  const count = await db.user.count({ where: { id: { in: memberIds }, tenantId: req.institution!.tenantId, courseId: req.body.courseId, role: { in: ['aluno', 'professor'] } } });
  if (count !== memberIds.length) return res.status(400).json({ error: 'Os participantes devem pertencer ao curso desta instituição.' });
  res.status(201).json(await db.classGroup.create({ data: { nome, memberIds, tenantId: req.institution!.tenantId, courseId: req.body.courseId }, include: { course: { select: { id: true, nome: true } } } }));
}));
institutionRouter.get('/conversations', route(async (req, res) => {
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor.length || cursor.length > 160)) return res.status(400).json({ error: 'Cursor de conversas inválido.' });
  const records = await db.conversation.findMany({ where: { tenantId: req.institution!.tenantId, memberIds: { has: req.institution!.id }, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 201 });
  const items = records.slice(0, 200);
  res.json({ items, nextCursor: records.length > 200 ? items[items.length - 1].id : null });
}));
institutionRouter.post('/conversations', route(async (req, res) => {
  if (!allow(req, res, 'chat.create')) return;
  const nome = cleanText(req.body.nome, 100), members = cleanMembers(req.body.memberIds);
  if (!nome || !members) return res.status(400).json({ error: 'Informe um nome e participantes válidos para o grupo.' });
  const memberIds = [...new Set([...members, req.institution!.id])];
  if (memberIds.length > 500 || await db.user.count({ where: { id: { in: memberIds }, tenantId: req.institution!.tenantId, role: { in: ['coord', 'professor', 'aluno'] } } }) !== memberIds.length) return res.status(400).json({ error: 'Os participantes devem pertencer a esta instituição.' });
  res.status(201).json(await db.conversation.create({ data: { nome, memberIds, tenantId: req.institution!.tenantId, createdBy: req.institution!.id } }));
}));
const memberConversation = (req: InstitutionRequest) => db.conversation.findFirst({ where: { id: req.params.id, tenantId: req.institution!.tenantId, memberIds: { has: req.institution!.id } } });
const messageSelect = { id: true, body: true, createdAt: true, sender: { select: { id: true, nome: true } } } as const;
institutionRouter.get('/conversations/:id/messages', route(async (req, res) => {
  if (!await memberConversation(req)) return res.status(404).json({ error: 'Conversa não encontrada.' });
  const messages = await db.conversationMessage.findMany({ where: { conversationId: req.params.id }, select: messageSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  res.json(messages.reverse());
}));
const sends = new Map<string, { count: number; start: number }>();
institutionRouter.post('/conversations/:id/messages', route(async (req, res) => {
  if (!await memberConversation(req)) return res.status(404).json({ error: 'Conversa não encontrada.' });
  const body = cleanText(req.body.body, 4000);
  if (!body) return res.status(400).json({ error: 'Escreva uma mensagem de até 4.000 caracteres.' });
  const now = Date.now(), key = req.institution!.id + ':' + req.params.id;
  for (const [oldKey, bucket] of sends) if (now - bucket.start >= 60000) sends.delete(oldKey);
  const bucket = sends.get(key) ?? { count: 0, start: now };
  if (bucket.count >= 30 || (!sends.has(key) && sends.size >= 10000)) return res.status(429).json({ error: 'Muitas mensagens. Aguarde um minuto para continuar.' });
  bucket.count++; sends.set(key, bucket);
  res.status(201).json(await db.conversationMessage.create({ data: { conversationId: req.params.id, senderId: req.institution!.id, body }, select: messageSelect }));
}));
