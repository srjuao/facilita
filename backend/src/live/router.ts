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
  classGroupId: true, roomSize: true, createdBy: true, startedAt: true, endedAt: true, createdAt: true, updatedAt: true,
  rooms: { select: { id: true, ordinal: true, label: true, memberIds: true, facilitatorId: true, facilitator: { select: { nome: true } } }, orderBy: { ordinal: 'asc' as const } },
} as const;
type Session = NonNullable<Awaited<ReturnType<typeof sessionById>>>;
const sessionById = (req: InstitutionRequest) => db.liveSession.findFirst({
  where: { id: req.params.id, tenantId: req.institution!.tenantId }, select: sessionSelect,
});
const isManager = (req: InstitutionRequest, session: { courseId: string | null }) => {
  const actor = req.institution!;
  return actor.role === 'coord' || actor.role === 'professor' && actor.permissions.includes('live.manage') && Boolean(session.courseId) && actor.courseId === session.courseId;
};
const canAttend = async (req: InstitutionRequest, session: Session): Promise<boolean> => {
  const actor = req.institution!;
  if (isManager(req, session)) return true;
  if (actor.role !== 'aluno') return false;
  if (!session.rooms?.some(room => room.memberIds.includes(actor.id))) return false;
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
const pilotMode = () => process.env.LIVE_PILOT_MODE === 'true';
// Shared by every tenant and every API replica. Keep the lock until the
// schedule/claim transaction commits so two simultaneous requests cannot pass.
const lockPilotCapacity = async (tx: any) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(117921184, 1)`;
};
const assertPilotSessionCapacity = (session: Session) => {
  if (session.rooms.length !== 1 || session.roomSize > 6 || session.rooms.some(room => room.memberIds.length > 6)) {
    fail(409, 'Esta aula excede o limite do piloto: uma sala com até 6 alunos. Agende uma nova aula menor.');
  }
};
// Each start claim owns a distinct generation. A stale worker can never create
// a room that a newer attempt has already closed, nor can it mint its token.
const childRoomName = (session: Session, tenantId: string, roomId: string, generation: Date) => 'facilita_' + createHash('sha256').update(tenantId + ':' + session.id + ':' + roomId + ':' + generation.toISOString()).digest('hex').slice(0, 40);
const roomClient = (config: NonNullable<ReturnType<typeof liveConfig>>) => new RoomServiceClient(config.url.replace(/^ws/, 'http'), config.apiKey, config.apiSecret);
const cleanupGeneration = async (session: Session, tenantId: string, generation: Date, config: NonNullable<ReturnType<typeof liveConfig>>) => {
  const client = roomClient(config);
  await Promise.allSettled(session.rooms.map(room => client.deleteRoom(childRoomName(session, tenantId, room.id, generation))));
};
const safeSession = (req: InstitutionRequest, session: Session) => {
  const actor = req.institution!;
  const { rooms, ...base } = session;
  const safeRooms = rooms?.map(room => ({ id: room.id, label: room.label, participantCount: room.memberIds.length, facilitatorId: room.facilitatorId, facilitatorName: room.facilitator?.nome ?? null })) ?? [];
  const own = actor.role === 'aluno' ? rooms?.find(room => room.memberIds.includes(actor.id)) : null;
  return { ...base, ...(actor.role === 'aluno' ? { myRoomId: own?.id ?? null, myRoomLabel: own?.label ?? null } : { roomCount: safeRooms.length, rooms: safeRooms }) };
};

liveRouter.use(requireInstitutionSession);
liveRouter.use((req: InstitutionRequest, res, next) => {
  if (!req.institution?.tenantId || req.institution.role === 'superadmin') return res.status(403).json({ error: 'Acesse com uma conta da instituição.' });
  next();
});

liveRouter.get('/capabilities', route(async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ pilotMode: pilotMode(), maxStudentsPerSession: pilotMode() ? 6 : null });
}));

liveRouter.get('/', route(async (req, res) => {
  const actor = req.institution!;
  if (actor.role === 'staff') return res.json({ items: [] });
  let scope: object = {};
  if (actor.role === 'professor') scope = actor.permissions.includes('live.manage') && actor.courseId ? { courseId: actor.courseId } : { id: '__no_live_access__' };
  if (actor.role === 'aluno') {
    const grants = await db.courseEntitlement.findMany({ where: { userId: actor.id, active: true, course: { tenantId: actor.tenantId } }, select: { courseId: true } });
    const ownCourse = actor.courseId ? await db.course.findFirst({ where: { id: actor.courseId, tenantId: actor.tenantId }, select: { id: true, paidContent: true } }) : null;
    const allowedCourseIds = [...new Set([...grants.map(grant => grant.courseId), ...(ownCourse && !ownCourse.paidContent ? [ownCourse.id] : [])])];
    scope = { rooms: { some: { memberIds: { has: actor.id } } }, OR: [
      { courseId: null, classGroupId: null },
      { courseId: { in: allowedCourseIds }, OR: [{ classGroupId: null }, { classGroup: { archivedAt: null, memberIds: { has: actor.id } } }] },
    ] };
  }
  const where = { tenantId: actor.tenantId, ...scope };
  const select = actor.role === 'aluno' ? { ...sessionSelect, rooms: { ...sessionSelect.rooms, where: { memberIds: { has: actor.id } } } } : sessionSelect;
  const now = new Date();
  const [active, upcoming, recent] = await Promise.all([
    // Include transitions so coordinators can retry a stuck start/end after 60s.
    db.liveSession.findMany({ where: { ...where, status: { in: ['live', 'starting', 'ending'] } }, select, orderBy: { startsAt: 'asc' }, take: 100 }),
    db.liveSession.findMany({ where: { ...where, status: 'scheduled', startsAt: { gte: now } }, select, orderBy: { startsAt: 'asc' }, take: 100 }),
    db.liveSession.findMany({ where: { AND: [where, { OR: [{ status: 'ended' }, { status: 'scheduled', startsAt: { lt: now } }] }] }, select, orderBy: { startsAt: 'desc' }, take: 50 }),
  ]);
  res.json({ items: [...active, ...upcoming, ...recent].map(session => safeSession(req, session)) });
}));

liveRouter.get('/facilitators', route(async (req, res) => {
  if (req.institution!.role !== 'coord') fail(403, 'Somente a coordenação pode atribuir responsáveis.');
  const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : null;
  if (!courseId) fail(400, 'Selecione um curso.');
  const course = await db.course.findFirst({ where: { id: courseId!, tenantId: req.institution!.tenantId }, select: { id: true } });
  if (!course) fail(404, 'Curso não encontrado.');
  const users = await db.user.findMany({ where: { tenantId: req.institution!.tenantId, disabledAt: null, OR: [{ role: 'coord' }, { role: 'professor', courseId: courseId!, permissions: { has: 'live.manage' } }] }, select: { id: true, nome: true, role: true }, orderBy: { nome: 'asc' }, take: 500 });
  res.json({ items: users });
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
  if (classGroupId === null || courseId === null) fail(400, 'Selecione um curso e uma turma para dividir a aula em salas.');
  const group = await db.classGroup.findFirst({ where: { id: classGroupId, tenantId: actor.tenantId, archivedAt: null }, select: { courseId: true, memberIds: true } });
  if (!group || group.courseId !== courseId) fail(400, 'Selecione a turma e o curso correspondentes.');
  const roomSize = req.body.roomSize === undefined ? (pilotMode() ? 6 : 30) : req.body.roomSize;
  if (!Number.isInteger(roomSize) || roomSize < (pilotMode() ? 1 : 10) || roomSize > (pilotMode() ? 6 : 50)) fail(400, pilotMode() ? 'No piloto, cada sala deve ter entre 1 e 6 alunos.' : 'Cada sala deve ter entre 10 e 50 alunos.');
  const candidateIds = [...new Set(group!.memberIds)];
  const eligible = await db.user.findMany({ where: { id: { in: candidateIds }, tenantId: actor.tenantId, courseId, role: 'aluno', disabledAt: null }, select: { id: true } });
  const members = eligible.map(user => user.id).sort();
  if (!members.length) fail(400, 'A turma não possui alunos para esta aula.');
  if (pilotMode() && members.length > 6) fail(409, 'O piloto aceita até 6 alunos por aula. Escolha uma turma menor.');
  const roomCount = Math.ceil(members.length / roomSize);
  const rooms = Array.from({ length: roomCount }, (_, index) => ({ ordinal: index + 1, label: `Sala ${index + 1}`, memberIds: members.slice(index * roomSize, (index + 1) * roomSize) }));
  if (pilotMode() && roomCount !== 1) fail(409, 'O piloto aceita apenas uma sala por aula.');
  const data = { tenantId: actor.tenantId, courseId, classGroupId, title: title!, startsAt: startsAt!, endsAt: endsAt!, createdBy: actor.id, roomSize, rooms: { create: rooms } };
  const session = pilotMode()
    ? await db.$transaction(async tx => {
      await lockPilotCapacity(tx);
      const overlap = await tx.liveSession.findFirst({ where: { status: { in: ['scheduled', 'starting', 'live', 'ending'] }, startsAt: { lt: endsAt! }, endsAt: { gt: startsAt! } }, select: { id: true } });
      if (overlap) fail(409, 'Já existe uma aula agendada ou ativa neste horário no servidor piloto. Escolha outro horário.');
      return tx.liveSession.create({ data, select: sessionSelect });
    })
    : await db.liveSession.create({ data, select: sessionSelect });
  res.status(201).json(safeSession(req, session));
}));

liveRouter.patch('/:id/rooms/:roomId', route(async (req, res) => {
  const session = await sessionById(req);
  if (!session) fail(404, 'Aula ao vivo não encontrada.');
  if (req.institution!.role !== 'coord') fail(403, 'Somente a coordenação pode atribuir responsáveis.');
  if (session!.status !== 'scheduled') fail(409, 'Atribuições só podem ser alteradas antes do início.');
  const facilitatorId = req.body.facilitatorId;
  if (facilitatorId !== null && (typeof facilitatorId !== 'string' || !facilitatorId || facilitatorId.length > 160)) fail(400, 'Selecione um responsável válido.');
  await db.$transaction(async tx => {
    // Updating the parent session serializes room assignment with start's CAS.
    // A concurrent PATCH/start can only win if it observed the same version.
    const claimed = await tx.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: 'scheduled', updatedAt: session!.updatedAt }, data: { updatedAt: new Date(Math.max(Date.now(), session!.updatedAt.getTime() + 1)) } });
    if (!claimed.count) fail(409, 'A aula mudou. Atualize antes de alterar as salas.');
    const current = await tx.liveSession.findFirst({ where: { id: session!.id, tenantId: req.institution!.tenantId }, select: sessionSelect });
    if (!current) fail(404, 'Aula ao vivo não encontrada.');
    const room = current!.rooms.find(item => item.id === req.params.roomId);
    if (!room) fail(404, 'Sala não encontrada nesta aula.');
    if (facilitatorId !== null) {
      const facilitator = await tx.user.findFirst({ where: { id: facilitatorId, tenantId: req.institution!.tenantId, disabledAt: null, OR: [{ role: 'coord' }, { role: 'professor', courseId: current!.courseId!, permissions: { has: 'live.manage' } }] }, select: { id: true } });
      if (!facilitator) fail(400, 'Responsável sem acesso a este curso ou à aula ao vivo.');
      if (current!.rooms.some(item => item.id !== room!.id && item.facilitatorId === facilitatorId)) fail(409, 'Este responsável já foi atribuído a outra sala desta aula.');
    }
    await tx.liveRoom.update({ where: { id: room!.id }, data: { facilitatorId } });
  });
  res.json(safeSession(req, (await sessionById(req))!));
}));

liveRouter.post('/:id/start', route(async (req, res) => {
  const session = await sessionById(req);
  if (!session) fail(404, 'Aula ao vivo não encontrada.');
  if (req.institution!.role !== 'coord') fail(403, 'Somente a coordenação pode iniciar todas as salas.');
  const config = liveConfig();
  if (!config) fail(503, 'A transmissão ao vivo ainda não foi configurada com salas privadas pelo administrador.');
  if (session!.status === 'ended') fail(409, 'Esta aula já foi encerrada. Agende uma nova aula.');
  if (session!.status === 'live') return res.json(safeSession(req, session!));
  if (!session!.rooms?.length || session!.rooms.some(room => !room.facilitatorId)) fail(409, 'Atribua um professor ou monitor a cada sala antes de iniciar.');
  const facilitatorIds = session!.rooms.map(room => room.facilitatorId!);
  if (new Set(facilitatorIds).size !== facilitatorIds.length) fail(409, 'Cada sala precisa de um responsável diferente.');
  const availableFacilitators = await db.user.count({ where: { id: { in: facilitatorIds }, tenantId: req.institution!.tenantId, disabledAt: null, OR: [{ role: 'coord' }, { role: 'professor', courseId: session!.courseId!, permissions: { has: 'live.manage' } }] } });
  if (availableFacilitators !== facilitatorIds.length) fail(409, 'Há salas com responsável sem acesso. Atualize as atribuições.');
  if (session!.classGroupId && !await db.classGroup.findFirst({ where: { id: session!.classGroupId, tenantId: req.institution!.tenantId, archivedAt: null }, select: { id: true } })) fail(409, 'Esta turma foi arquivada.');
  if (session!.endsAt.getTime() <= Date.now()) fail(409, 'O horário desta aula já passou. Agende uma nova aula.');
  if (session!.startsAt.getTime() > Date.now() + 30 * 60000) fail(409, 'A sala pode ser iniciada a partir de 30 minutos antes da aula.');
  if (pilotMode()) assertPilotSessionCapacity(session!);
  const recover = session!.status === 'starting' && session!.updatedAt.getTime() <= Date.now() - 60000;
  if (session!.status !== 'scheduled' && !recover) fail(409, 'A sala está sendo preparada. Aguarde um instante e tente novamente.');
  const claimVersion = new Date(Math.max(Date.now(), session!.updatedAt.getTime() + 1));
  const claimWhere = { id: session!.id, tenantId: req.institution!.tenantId, status: session!.status, updatedAt: session!.updatedAt };
  const claimData = { status: 'starting', startedAt: claimVersion, updatedAt: claimVersion };
  const claimed = pilotMode()
    ? await db.$transaction(async tx => {
      await lockPilotCapacity(tx);
      const otherActive = await tx.liveSession.findFirst({ where: { id: { not: session!.id }, status: { in: ['starting', 'live', 'ending'] } }, select: { id: true } });
      if (otherActive) fail(409, 'O servidor piloto já está transmitindo uma aula. Aguarde o encerramento.');
      return tx.liveSession.updateMany({ where: claimWhere, data: claimData });
    })
    : await db.liveSession.updateMany({ where: claimWhere, data: claimData });
  if (!claimed.count) fail(409, 'O estado da aula mudou. Atualize a lista.');
  try {
    const client = roomClient(config!);
    const lifetimeSeconds = Math.max(600, Math.ceil((session!.endsAt.getTime() - Date.now()) / 1000) + 1800);
    const names = session!.rooms.map(room => childRoomName(session!, req.institution!.tenantId, room.id, claimVersion));
    const existing = new Set((await client.listRooms(names)).map(room => room.name));
    for (let index = 0; index < session!.rooms.length; index++) {
      const name = names[index];
      if (existing.has(name)) continue;
      try { await client.createRoom({ name, emptyTimeout: lifetimeSeconds, departureTimeout: lifetimeSeconds, maxParticipants: session!.roomSize + 2 }); }
      catch (error) {
        // Two recovery attempts may see the room missing at the same time.
        // A room created by the other attempt is already the desired state.
        if (!(await client.listRooms([name])).length) throw error;
      }
    }
  }
  catch {
    // A retry can claim a stuck start after 60 seconds. Only this claim may reset it.
    await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: 'starting', updatedAt: claimVersion }, data: { status: 'scheduled', startedAt: null } });
    await cleanupGeneration(session!, req.institution!.tenantId, claimVersion, config!);
    fail(503, 'Não foi possível preparar a sala de vídeo. Tente novamente.');
  }
  const result = await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: 'starting', updatedAt: claimVersion }, data: { status: 'live' } });
  if (!result.count) {
    await cleanupGeneration(session!, req.institution!.tenantId, claimVersion, config!);
    fail(409, 'O estado da aula mudou. Atualize a lista.');
  }
  res.json(safeSession(req, (await sessionById(req))!));
}));

liveRouter.post('/:id/end', route(async (req, res) => {
  const session = await sessionById(req);
  if (!session) fail(404, 'Aula ao vivo não encontrada.');
  if (req.institution!.role !== 'coord') fail(403, 'Somente a coordenação pode encerrar todas as salas.');
  if (session!.status === 'ended') return res.json(safeSession(req, session!));
  if (session!.status === 'starting') fail(409, 'A sala ainda está sendo preparada. Aguarde antes de encerrar.');
  if (session!.status === 'live' || session!.status === 'ending') {
    if (!session!.startedAt) fail(503, 'Não foi possível identificar a geração das salas desta aula.');
    const config = liveConfig();
    if (!config) fail(503, 'A transmissão ao vivo não está configurada; não é seguro encerrar sem desconectar a sala.');
    const recover = session!.status === 'ending' && session!.updatedAt.getTime() <= Date.now() - 60000;
    if (session!.status === 'ending' && !recover) fail(409, 'A aula está sendo encerrada. Aguarde um instante e tente novamente.');
    const claimed = await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: session!.status, ...(recover ? { updatedAt: session!.updatedAt } : {}) }, data: { status: 'ending' } });
    if (!claimed.count) fail(409, 'O estado da aula mudou. Atualize a lista.');
    for (const room of session!.rooms ?? []) {
      try { await roomClient(config!).deleteRoom(childRoomName(session!, req.institution!.tenantId, room.id, session!.startedAt!)); }
      catch (error) {
        // Retrying ending state will skip rooms already deleted.
        const code = (error as { code?: string | number }).code;
        if (code !== 'not_found' && code !== 404) fail(503, 'Não foi possível desconectar todas as salas. Tente encerrar novamente.');
      }
    }
  }
  const result = await db.liveSession.updateMany({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: session!.status === 'scheduled' ? 'scheduled' : 'ending' }, data: { status: 'ended', endedAt: new Date() } });
  if (!result.count) fail(409, 'O estado da aula mudou. Atualize a lista.');
  res.json(safeSession(req, (await sessionById(req))!));
}));

liveRouter.post('/:id/join', route(async (req, res) => {
  const session = await sessionById(req);
  if (!session) fail(404, 'Aula ao vivo não encontrada.');
  if (session!.status !== 'live') fail(409, 'Esta aula não está ao vivo no momento.');
  if (session!.endsAt.getTime() + 30 * 60000 <= Date.now()) fail(409, 'O horário desta aula terminou. Peça à coordenação para agendar uma nova aula.');
  if (!await canAttend(req, session!)) fail(403, 'Sua conta não está autorizada a participar desta aula.');
  const config = liveConfig();
  if (!config) fail(503, 'A transmissão ao vivo ainda não foi configurada pelo administrador.');
  if (!session!.startedAt) fail(503, 'Não foi possível identificar a geração das salas desta aula.');
  const user = await db.user.findFirst({ where: { id: req.institution!.id, tenantId: req.institution!.tenantId, disabledAt: null }, select: { nome: true } });
  if (!user) fail(403, 'Sua conta não está disponível nesta instituição.');
  const manager = isManager(req, session!);
  const assigned = session!.rooms?.find(item => item.memberIds.includes(req.institution!.id));
  const requestedId = req.body.roomId;
  const selected = manager ? session!.rooms?.find(item => item.id === requestedId) : assigned;
  if (!selected || manager && !requestedId) fail(400, 'Selecione uma sala válida desta aula.');
  if (manager && req.institution!.role === 'professor' && selected!.facilitatorId !== req.institution!.id) fail(403, 'Você não é responsável por esta sala.');
  const room = childRoomName(session!, req.institution!.tenantId, selected!.id, session!.startedAt!);
  const token = new AccessToken(config!.apiKey, config!.apiSecret, { identity: req.institution!.id, name: user!.nome, ttl: 5 * 60 });
  token.addGrant({ roomJoin: true, room, canPublish: true, canPublishData: true, canSubscribe: true });
  if (!await db.liveSession.findFirst({ where: { id: session!.id, tenantId: req.institution!.tenantId, status: 'live' }, select: { id: true } })) fail(409, 'Esta aula foi encerrada enquanto você tentava entrar.');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ url: config!.url, token: await token.toJwt(), roomName: room, roomLabel: selected!.label, session: safeSession(req, session!) });
}));
