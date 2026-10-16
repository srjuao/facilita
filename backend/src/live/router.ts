import { Router, Response, NextFunction } from 'express';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { createHash } from 'crypto';
import { InstitutionRequest, institutionDb as db, requireInstitutionSession, cleanText } from '../institution/policy';
import { assertCourseContentAccess } from '../commerce/access';

export const liveRouter = Router();

class LiveError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new LiveError(status, message); };
const route = (handler: (req: InstitutionRequest, res: Response) => Promise<unknown>) => (req: InstitutionRequest, res: Response, _next: NextFunction) => {
  Promise.resolve(handler(req, res)).catch((error: unknown) => {
    if (error instanceof LiveError) return res.status(error.status).json({ error: error.message });
    if (error instanceof Error && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 500) return res.status(error.status).json({ error: error.message });
    res.status(503).json({ error: 'Não foi possível acessar as aulas ao vivo. Tente novamente.' });
  });
};
const sessionSelect = {
  id: true, title: true, startsAt: true, endsAt: true, status: true, courseId: true,
  classGroupId: true, createdBy: true, startedAt: true, endedAt: true, createdAt: true, updatedAt: true,
} as const;
type Session = NonNullable<Awaited<ReturnType<typeof sessionById>>>;
const sessionById = (req: InstitutionRequest) => db.liveSession.findFirst({
  where: { id: req.params.id, tenantId: req.institution!.tenantId }, select: sessionSelect,
});
const isManager = (req: InstitutionRequest, session: { courseId: string | null }) => {
  const actor = req.institution!;
  return actor.role === 'coord' || actor.role === 'professor' && actor.permissions.includes('live.manage') && Boolean(session.courseId) && actor.courseId === session.courseId;
};
const requireManager = (req: InstitutionRequest, session: { courseId: string | null }) => {
  if (!isManager(req, session)) fail(403, 'Você não tem permissão para gerenciar esta aula ao vivo.');
};
const canAttend = async (req: InstitutionRequest, session: Session): Promise<boolean> => {
  const actor = req.institution!;
  if (isManager(req, session)) return true;
  if (actor.role !== 'aluno') return false;
  if (session.classGroupId) {
    const group = await db.classGroup.findFirst({ where: { id: session.classGroupId, tenantId: actor.tenantId, archivedAt: null, memberIds: { has: actor.id } }, select: { id: true } });
    if (!group) return false;
  }
  if (session.courseId) {
    const course = await db.course.findFirst({ where: { id: session.courseId, tenantId: actor.tenantId }, select: { id: true, tenantId: true, paidContent: true, contentPriceCents: true } });
    if (!course) return false;
    try { await assertCourseContentAccess({ id: actor.id, tenantId: actor.tenantId, courseId: actor.courseId, role: actor.role }, course); }
    catch { return false; }
  }
  return true;
};
const liveConfig = () => {
  const url = process.env.LIVEKIT_URL?.trim() ?? '';
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? '';
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? '';
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  // Self-hosted LiveKit must have room.auto_create=false. Otherwise an unexpired
  // participant token can recreate a room after DeleteRoom and defeat closure.
  if (process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED !== 'true' || !['ws:', 'wss:'].includes(parsed.protocol) || !apiKey || !apiSecret || parsed.username || parsed.password) return null;
  return { url: parsed.toString(), apiKey, apiSecret };
};
const roomName = (session: Session, tenantId: string) => 'facilita_' + createHash('sha256').update(tenantId + ':' + session.id).digest('hex').slice(0, 40);
const roomClient = (config: NonNullable<ReturnType<typeof liveConfig>>) => new RoomServiceClient(config.url.replace(/^ws/, 'http'), config.apiKey, config.apiSecret);

liveRouter.use(requireInstitutionSession);
liveRouter.use((req: InstitutionRequest, res, next) => {
  if (!req.institution?.tenantId || req.institution.role === 'superadmin') return res.status(403).json({ error: 'Acesse com uma conta da instituição.' });
  next();
});

liveRouter.get('/', route(async (req, res) => {
  const actor = req.institution!;
  if (actor.role === 'staff') return res.json({ items: [] });
  let scope: object = {};
  if (actor.role === 'professor') scope = actor.permissions.includes('live.manage') && actor.courseId ? { courseId: actor.courseId } : { id: '__no_live_access__' };
  if (actor.role === 'aluno') {
    const grants = await db.courseEntitlement.findMany({ where: { userId: actor.id, active: true, course: { tenantId: actor.tenantId } }, select: { courseId: true } });
    const ownCourse = actor.courseId ? await db.course.findFirst({ where: { id: actor.courseId, tenantId: actor.tenantId }, select: { id: true, paidContent: true } }) : null;
    const allowedCourseIds = [...new Set([...grants.map(grant => grant.courseId), ...(ownCourse && !ownCourse.paidContent ? [ownCourse.id] : [])])];
    scope = { OR: [
      { courseId: null, classGroupId: null },
      { courseId: { in: allowedCourseIds }, OR: [{ classGroupId: null }, { classGroup: { archivedAt: null, memberIds: { has: actor.id } } }] },
    ] };
  }
  const where = { tenantId: actor.tenantId, ...scope };
  const now = new Date();
  const [active, upcoming, recent] = await Promise.all([
    // Include transitions so coordinators can retry a stuck start/end after 60s.
    db.liveSession.findMany({ where: { ...where, status: { in: ['live', 'starting', 'ending'] } }, select: sessionSelect, orderBy: { startsAt: 'asc' }, take: 100 }),
    db.liveSession.findMany({ where: { ...where, status: 'scheduled', startsAt: { gte: now } }, select: sessionSelect, orderBy: { startsAt: 'asc' }, take: 100 }),
    db.liveSession.findMany({ where: { AND: [where, { OR: [{ status: 'ended' }, { status: 'scheduled', startsAt: { lt: now } }] }] }, select: sessionSelect, orderBy: { startsAt: 'desc' }, take: 50 }),
  ]);
  res.json({ items: [...active, ...upcoming, ...recent] });
}));

liveRouter.post('/', route(async (req, res) => {
  const actor = req.institution!;
  if (actor.role !== 'coord') fail(403, 'Somente a coordenação pode agendar aulas ao vivo.');
  const title = cleanText(req.body.title, 160);
  const startsAt = typeof req.body.startsAt === 'string' ? new Date(req.body.startsAt) : null;
  const endsAt = typeof req.body.endsAt === 'string' ? new Date(req.body.endsAt) : null;
  if (!title || !startsAt || !endsAt || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 8 * 3600000) fail(400, 'Informe título e horário válido, com duração de até 8 horas.');
  const courseId = req.body.courseId === undefined || req.body.courseId === null || req.body.courseId === '' ? null : req.body.courseId;
  const classGroupId = req.body.classGroupId === undefined || req.body.classGroupId === null || req.body.classGroupId === '' ? null : req.body.classGroupId;
  if (courseId !== null && (typeof courseId !== 'string' || courseId.length > 160 || !await db.course.findFirst({ where: { id: courseId, tenantId: actor.tenantId }, select: { id: true } }))) fail(400, 'Curso não encontrado nesta instituição.');
  if (classGroupId !== null && (typeof classGroupId !== 'string' || classGroupId.length > 160)) fail(400, 'Turma inválida.');
  if (classGroupId !== null) {
    const group = await db.classGroup.findFirst({ where: { id: classGroupId, tenantId: actor.tenantId, archivedAt: null }, select: { courseId: true } });
    if (!group || group.courseId !== courseId) fail(400, 'Selecione a turma e o curso correspondentes.');
  }
  const session = await db.liveSession.create({ data: { tenantId: actor.tenantId, courseId, classGroupId, title: title!, startsAt: startsAt!, endsAt: endsAt!, createdBy: actor.id }, select: sessionSelect });
  res.status(201).json(session);
}));

liveRouter.post('/:id/start', route(async (req, res) => {
  const session = await sessionById(req);
  if (!session) fail(404, 'Aula ao vivo não encontrada.');
  requireManager(req, session!);
  const config = liveConfig();
  if (!config) fail(503, 'A transmissão ao vivo ainda não foi configurada com salas privadas pelo administrador.');
  if (session!.status === 'ended') fail(409, 'Esta aula já foi encerrada. Agende uma nova aula.');
  if (session!.status === 'live') return res.json(session);
  if (session!.endsAt.getTime() <= Date.now()) fail(409, 'O horário desta aula já passou. Agende uma nova aula.');
  if (session!.startsAt.getTime() > Date.now() + 30 * 60000) fail(409, 'A sala pode ser iniciada a partir de 30 minutos antes da aula.');
  const recover = session!.status === 'starting' && session!.updatedAt.getTime() <= Date.now() - 60000;
  if (session!.status !== 'scheduled' && !recover) fail(409, 'A sala está sendo preparada. Aguarde um instante e tente novamente.');
  const claimed = await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: session!.status, ...(recover ? { updatedAt: session!.updatedAt } : {}) }, data: { status: 'starting' } });
  if (!claimed.count) fail(409, 'O estado da aula mudou. Atualize a lista.');
  try {
    const client = roomClient(config!);
    const name = roomName(session!, req.institution!.tenantId);
    const existing = recover ? await client.listRooms([name]) : [];
    const lifetimeSeconds = Math.max(600, Math.ceil((session!.endsAt.getTime() - Date.now()) / 1000) + 1800);
    if (!existing.length) await client.createRoom({ name, emptyTimeout: lifetimeSeconds, departureTimeout: lifetimeSeconds });
  }
  catch {
    await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: 'starting' }, data: { status: 'scheduled' } });
    fail(503, 'Não foi possível preparar a sala de vídeo. Tente novamente.');
  }
  const result = await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: 'starting' }, data: { status: 'live', startedAt: new Date() } });
  if (!result.count) fail(409, 'O estado da aula mudou. Atualize a lista.');
  res.json(await sessionById(req));
}));

liveRouter.post('/:id/end', route(async (req, res) => {
  const session = await sessionById(req);
  if (!session) fail(404, 'Aula ao vivo não encontrada.');
  requireManager(req, session!);
  if (session!.status === 'ended') return res.json(session);
  if (session!.status === 'starting') fail(409, 'A sala ainda está sendo preparada. Aguarde antes de encerrar.');
  if (session!.status === 'live' || session!.status === 'ending') {
    const config = liveConfig();
    if (!config) fail(503, 'A transmissão ao vivo não está configurada; não é seguro encerrar sem desconectar a sala.');
    const recover = session!.status === 'ending' && session!.updatedAt.getTime() <= Date.now() - 60000;
    if (session!.status === 'ending' && !recover) fail(409, 'A aula está sendo encerrada. Aguarde um instante e tente novamente.');
    const claimed = await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: session!.status, ...(recover ? { updatedAt: session!.updatedAt } : {}) }, data: { status: 'ending' } });
    if (!claimed.count) fail(409, 'O estado da aula mudou. Atualize a lista.');
    try { await roomClient(config!).deleteRoom(roomName(session!, req.institution!.tenantId)); }
    catch (error) {
      // A missing room has no participants to disconnect. Any other failure must not report closure.
      const code = (error as { code?: string | number }).code;
      if (code !== 'not_found' && code !== 404) fail(503, 'Não foi possível desconectar a sala. Tente encerrar novamente.');
    }
  }
  const result = await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: session!.status === 'scheduled' ? 'scheduled' : 'ending' }, data: { status: 'ended', endedAt: new Date() } });
  if (!result.count) fail(409, 'O estado da aula mudou. Atualize a lista.');
  res.json(await sessionById(req));
}));

liveRouter.post('/:id/join', route(async (req, res) => {
  const session = await sessionById(req);
  if (!session) fail(404, 'Aula ao vivo não encontrada.');
  if (session!.status !== 'live') fail(409, 'Esta aula não está ao vivo no momento.');
  if (session!.endsAt.getTime() + 30 * 60000 <= Date.now()) fail(409, 'O horário desta aula terminou. Peça à coordenação para agendar uma nova aula.');
  if (!await canAttend(req, session!)) fail(403, 'Sua conta não está autorizada a participar desta aula.');
  const config = liveConfig();
  if (!config) fail(503, 'A transmissão ao vivo ainda não foi configurada pelo administrador.');
  const user = await db.user.findFirst({ where: { id: req.institution!.id, tenantId: req.institution!.tenantId, disabledAt: null }, select: { nome: true } });
  if (!user) fail(403, 'Sua conta não está disponível nesta instituição.');
  const room = roomName(session!, req.institution!.tenantId);
  const manager = isManager(req, session!);
  const token = new AccessToken(config!.apiKey, config!.apiSecret, { identity: req.institution!.id, name: user!.nome, ttl: 5 * 60 });
  token.addGrant({ roomJoin: true, room, canPublish: manager, canPublishData: manager, canSubscribe: true });
  if (!await db.liveSession.findFirst({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: 'live' }, select: { id: true } })) fail(409, 'Esta aula foi encerrada enquanto você tentava entrar.');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ url: config!.url, token: await token.toJwt(), roomName: room, session });
}));
