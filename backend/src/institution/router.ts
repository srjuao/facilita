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

const editVersion = (req: InstitutionRequest, res: Response) => {
  const value = req.body.expectedUpdatedAt;
  const version = typeof value === 'string' ? new Date(value) : null;
  if (!version || Number.isNaN(version.getTime()) || (req.body.archived !== undefined && typeof req.body.archived !== 'boolean')) {
    res.status(400).json({ error: 'Atualize a lista antes de editar. A versão do registro ou o estado informado é inválido.' });
    return null;
  }
  return version;
};
const archiveChange = (req: InstitutionRequest) => req.body.archived === undefined ? {} : { archivedAt: req.body.archived ? new Date() : null };
const conflict = (res: Response) => res.status(409).json({ error: 'Este registro foi alterado por outra pessoa. Atualize a lista antes de salvar novamente.' });

institutionRouter.get('/departments', route(async (req, res) => {
  if (!coord(req, res)) return;
  res.json(await db.department.findMany({ where: { tenantId: req.institution!.tenantId, archivedAt: req.query.archived === 'true' ? { not: null } : null }, orderBy: { nome: 'asc' } }));
}));
institutionRouter.patch('/departments/:id', route(async (req, res) => {
  if (!coord(req, res)) return;
  const version = editVersion(req, res); if (!version) return;
  const nome = cleanText(req.body.nome, 100);
  if (!nome) return res.status(400).json({ error: 'Informe um nome de até 100 caracteres.' });
  const where = { id: req.params.id, tenantId: req.institution!.tenantId };
  if (!await db.department.findFirst({ where })) return res.status(404).json({ error: 'Departamento não encontrado.' });
  const result = await db.department.updateMany({ where: { ...where, updatedAt: version }, data: { nome, ...archiveChange(req) } });
  if (!result.count) return conflict(res);
  res.json(await db.department.findFirst({ where }));
}));
institutionRouter.patch('/notices/:id', route(async (req, res) => {
  if (!allow(req, res, 'notices.manage')) return;
  const version = editVersion(req, res); if (!version) return;
  const title = cleanText(req.body.title, 160), body = cleanText(req.body.body, 10000);
  if (!title || !body) return res.status(400).json({ error: 'Informe título (até 160 caracteres) e aviso (até 10.000 caracteres).' });
  const where = { id: req.params.id, tenantId: req.institution!.tenantId };
  if (!await db.announcement.findFirst({ where })) return res.status(404).json({ error: 'Aviso não encontrado.' });
  const result = await db.announcement.updateMany({ where: { ...where, updatedAt: version }, data: { title, body, ...archiveChange(req) } });
  if (!result.count) return conflict(res);
  res.json(await db.announcement.findFirst({ where, include: { author: { select: { id: true, nome: true } } } }));
}));
institutionRouter.patch('/periods/:id', route(async (req, res) => {
  if (!allow(req, res, 'content.manage')) return;
  const version = editVersion(req, res); if (!version) return;
  const nome = cleanText(req.body.nome, 100);
  if (!nome) return res.status(400).json({ error: 'Informe um nome de até 100 caracteres.' });
  const where = { id: req.params.id, tenantId: req.institution!.tenantId, ...(req.institution!.role === 'coord' ? {} : { courseId: req.institution!.courseId ?? '' }) };
  if (!await db.academicPeriod.findFirst({ where })) return res.status(404).json({ error: 'Período não encontrado no seu curso.' });
  const result = await db.academicPeriod.updateMany({ where: { ...where, updatedAt: version }, data: { nome, ...archiveChange(req) } });
  if (!result.count) return conflict(res);
  res.json(await db.academicPeriod.findFirst({ where, include: { course: { select: { id: true, nome: true } }, _count: { select: { modules: true } } } }));
}));
institutionRouter.patch('/classes/:id', route(async (req, res) => {
  if (!allow(req, res, 'classes.manage')) return;
  const version = editVersion(req, res); if (!version) return;
  const nome = cleanText(req.body.nome, 100), memberIds = cleanMembers(req.body.memberIds);
  if (!nome || !memberIds) return res.status(400).json({ error: 'Informe nome e participantes válidos.' });
  const where = { id: req.params.id, tenantId: req.institution!.tenantId, ...(req.institution!.role === 'coord' ? {} : { courseId: req.institution!.courseId ?? '' }) };
  const room = await db.classGroup.findFirst({ where });
  if (!room) return res.status(404).json({ error: 'Turma não encontrada no seu curso.' });
  if (req.body.courseId !== undefined && req.body.courseId !== room.courseId) return res.status(400).json({ error: 'O curso de uma turma não pode ser alterado.' });
  const addedIds = memberIds.filter(id => !room.memberIds.includes(id));
  const count = addedIds.length ? await db.user.count({ where: { id: { in: addedIds }, tenantId: req.institution!.tenantId, disabledAt: null, courseId: room.courseId, role: { in: ['aluno', 'professor'] } } }) : 0;
  if (count !== addedIds.length) return res.status(400).json({ error: 'Os novos participantes devem pertencer ao curso desta instituição.' });
  const result = await db.classGroup.updateMany({ where: { ...where, updatedAt: version }, data: { nome, memberIds, ...archiveChange(req) } });
  if (!result.count) return conflict(res);
  res.json(await db.classGroup.findFirst({ where, include: { course: { select: { id: true, nome: true } } } }));
}));
institutionRouter.patch('/conversations/:id', route(async (req, res) => {
  if (!allow(req, res, 'chat.create')) return;
  const version = editVersion(req, res); if (!version) return;
  const nome = cleanText(req.body.nome, 100), members = cleanMembers(req.body.memberIds);
  if (!nome || !members) return res.status(400).json({ error: 'Informe nome e participantes válidos.' });
  // The editor remains a participant; removed people immediately lose access.
  const memberIds = [...new Set([...members, req.institution!.id])];
  if (memberIds.length > 500) return res.status(400).json({ error: 'Selecione até 500 participantes.' });
  const where = { id: req.params.id, tenantId: req.institution!.tenantId, memberIds: { has: req.institution!.id } };
  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${req.params.id} FOR UPDATE`;
    const current = await tx.conversation.findFirst({ where });
    if (!current) return { missing: true };
    const addedIds = memberIds.filter(id => !current.memberIds.includes(id));
    if (addedIds.length && await tx.user.count({ where: { id: { in: addedIds }, tenantId: req.institution!.tenantId, disabledAt: null, role: { in: ['coord', 'professor', 'aluno', 'staff'] } } }) !== addedIds.length) return { invalid: true };
    const changed = await tx.conversation.updateMany({ where: { ...where, updatedAt: version }, data: { nome, memberIds, ...archiveChange(req) } });
    if (!changed.count) return { stale: true };
    return { conversation: await tx.conversation.findFirst({ where }) };
  });
  if ('missing' in result) return res.status(404).json({ error: 'Conversa não encontrada.' });
  if ('invalid' in result) return res.status(400).json({ error: 'Os novos participantes devem pertencer a esta instituição.' });
  if ('stale' in result) return conflict(res);
  res.json(result.conversation);
}));

institutionRouter.get('/access', route(async (req, res) => res.json({ permissions: req.institution!.permissions })));
institutionRouter.get('/directory', route(async (req, res) => {
  const tenantId = req.institution!.tenantId;
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor.length || cursor.length > 160)) return res.status(400).json({ error: 'Cursor de usuários inválido.' });
  const where = { tenantId, disabledAt: null, role: { in: ['coord', 'professor', 'aluno', 'staff'] } };
  const [records, totalUsers, departments, courses] = await Promise.all([
    db.user.findMany({ where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) }, select: { id: true, nome: true, email: true, role: true, departmentId: true, permissions: true, courseId: true }, orderBy: { id: 'asc' }, take: 201 }),
    db.user.count({ where }),
    db.department.findMany({ where: { tenantId, archivedAt: null }, select: { id: true, nome: true, updatedAt: true, archivedAt: true }, orderBy: { nome: 'asc' } }),
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
  if (departmentId && departmentId !== target.departmentId && !await db.department.findFirst({ where: { id: departmentId, tenantId, archivedAt: null } })) return res.status(400).json({ error: 'Departamento ativo não encontrado nesta instituição.' });
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
institutionRouter.get('/notices', route(async (req, res) => res.json(await db.announcement.findMany({ where: { tenantId: req.institution!.tenantId, archivedAt: req.query.archived === 'true' && req.institution!.permissions.includes('notices.manage') ? { not: null } : null }, include: { author: { select: { id: true, nome: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }))));
institutionRouter.post('/notices', route(async (req, res) => {
  if (!allow(req, res, 'notices.manage')) return;
  const title = cleanText(req.body.title, 160), body = cleanText(req.body.body, 10000);
  if (!title || !body) return res.status(400).json({ error: 'Informe título (até 160 caracteres) e aviso (até 10.000 caracteres).' });
  res.status(201).json(await db.announcement.create({ data: { title, body, tenantId: req.institution!.tenantId, createdBy: req.institution!.id }, include: { author: { select: { id: true, nome: true } } } }));
}));
institutionRouter.get('/periods', route(async (req, res) => {
  const session = req.institution!;
  res.json(await db.academicPeriod.findMany({ where: { tenantId: session.tenantId, archivedAt: req.query.archived === 'true' && session.permissions.includes('content.manage') ? { not: null } : null, ...(session.role === 'coord' ? {} : { courseId: session.courseId ?? '' }) }, include: { course: { select: { id: true, nome: true } }, _count: { select: { modules: true } } }, orderBy: { nome: 'asc' } }));
}));
institutionRouter.post('/periods', route(async (req, res) => {
  if (!allow(req, res, 'content.manage')) return;
  const nome = cleanText(req.body.nome, 100);
  if (!nome || !await courseAllowed(req, req.body.courseId)) return res.status(400).json({ error: 'Informe um nome e um curso autorizado para este período.' });
  res.status(201).json(await db.academicPeriod.create({ data: { nome, courseId: req.body.courseId, tenantId: req.institution!.tenantId } }));
}));
institutionRouter.get('/classes', route(async (req, res) => {
  const session = req.institution!;
  res.json(await db.classGroup.findMany({ where: { tenantId: session.tenantId, archivedAt: req.query.archived === 'true' && session.permissions.includes('classes.manage') ? { not: null } : null, ...(session.role === 'coord' ? {} : session.role === 'professor' ? { courseId: session.courseId ?? '' } : { memberIds: { has: session.id } }) }, include: { course: { select: { id: true, nome: true } } }, orderBy: { nome: 'asc' } }));
}));
institutionRouter.post('/classes', route(async (req, res) => {
  if (!allow(req, res, 'classes.manage')) return;
  const nome = cleanText(req.body.nome, 100), memberIds = cleanMembers(req.body.memberIds);
  if (!nome || !memberIds || !await courseAllowed(req, req.body.courseId)) return res.status(400).json({ error: 'Informe nome, curso e participantes válidos.' });
  const count = await db.user.count({ where: { id: { in: memberIds }, tenantId: req.institution!.tenantId, disabledAt: null, courseId: req.body.courseId, role: { in: ['aluno', 'professor'] } } });
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
  if (memberIds.length > 500 || await db.user.count({ where: { id: { in: memberIds }, disabledAt: null, tenantId: req.institution!.tenantId, role: { in: ['coord', 'professor', 'aluno', 'staff'] } } }) !== memberIds.length) return res.status(400).json({ error: 'Os participantes devem pertencer a esta instituição.' });
  res.status(201).json(await db.conversation.create({ data: { nome, memberIds, tenantId: req.institution!.tenantId, createdBy: req.institution!.id } }));
}));
const memberConversation = (req: InstitutionRequest) => db.conversation.findFirst({ where: { id: req.params.id, tenantId: req.institution!.tenantId, memberIds: { has: req.institution!.id } } });
const messageSelect = { id: true, body: true, createdAt: true, sender: { select: { id: true, nome: true } } } as const;
institutionRouter.get('/conversations/:id/messages', route(async (req, res) => {
  if (!await memberConversation(req)) return res.status(404).json({ error: 'Conversa não encontrada.' });
  const messages = await db.conversationMessage.findMany({ where: { conversationId: req.params.id, conversation: { tenantId: req.institution!.tenantId, memberIds: { has: req.institution!.id } } }, select: messageSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  res.json(messages.reverse());
}));
const sends = new Map<string, { count: number; start: number }>();
institutionRouter.post('/conversations/:id/messages', route(async (req, res) => {
  const conversation = await memberConversation(req);
  if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });
  if (conversation.archivedAt) return res.status(409).json({ error: 'Esta conversa está arquivada. O histórico continua disponível, mas não aceita novas mensagens.' });
  const body = cleanText(req.body.body, 4000);
  if (!body) return res.status(400).json({ error: 'Escreva uma mensagem de até 4.000 caracteres.' });
  const now = Date.now(), key = req.institution!.id + ':' + req.params.id;
  for (const [oldKey, bucket] of sends) if (now - bucket.start >= 60000) sends.delete(oldKey);
  const bucket = sends.get(key) ?? { count: 0, start: now };
  if (bucket.count >= 30 || (!sends.has(key) && sends.size >= 10000)) return res.status(429).json({ error: 'Muitas mensagens. Aguarde um minuto para continuar.' });
  bucket.count++; sends.set(key, bucket);
  const message = await db.$transaction(async tx => {
    // Serialize membership edits and message sends on the same conversation.
    await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${req.params.id} FOR UPDATE`;
    const current = await tx.conversation.findFirst({ where: { id: req.params.id, tenantId: req.institution!.tenantId, memberIds: { has: req.institution!.id }, archivedAt: null } });
    if (!current) return null;
    return tx.conversationMessage.create({ data: { conversationId: current.id, senderId: req.institution!.id, body }, select: messageSelect });
  });
  if (!message) return res.status(409).json({ error: 'O acesso ou o estado desta conversa mudou. Atualize a lista.' });
  res.status(201).json(message);
}));
