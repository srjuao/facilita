const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { liveRouter } = require('../dist/live/router');
const { institutionDb: db, requireInstitutionSession, effectivePermissions } = require('../dist/institution/policy');
const { RoomServiceClient } = require('livekit-server-sdk');

const actor = (role = 'coord', overrides = {}) => ({
  id: 'user-a', email: 'user@example.invalid', role, tenantId: 'tenant-a',
  courseId: role === 'coord' ? null : 'course-a', permissions: [], disabledAt: null,
  tenant: { ativo: true }, ...overrides,
});
const request = (path, method = 'GET', body = {}) => new Promise((resolve, reject) => {
  const url = new URL(path, 'http://localhost');
  const layer = liveRouter.stack.find(item => item.route && item.route.methods[method.toLowerCase()] && item.match(url.pathname));
  assert.ok(layer, `${method} ${path} must exist`);
  const req = { body, params: layer.params, query: Object.fromEntries(url.searchParams), user: { id: 'user-a', role: 'superadmin', tenantId: 'forged' } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, setHeader() { return this; }, json(value) { resolve({ status: this.statusCode, body: value }); return this; } };
  Promise.resolve(requireInstitutionSession(req, res, () => layer.route.stack[0].handle(req, res, reject))).catch(reject);
});

test('LiveKit permission is explicit for teachers and never granted to students', () => {
  assert.ok(effectivePermissions('coord', []).includes('live.manage'));
  assert.deepEqual(effectivePermissions('professor', ['live.manage']), ['live.manage']);
  assert.deepEqual(effectivePermissions('aluno', ['live.manage']), []);
});

test('live session lookup is tenant-scoped and refuses foreign room', async () => {
  db.user.findUnique = async () => actor();
  db.liveSession.findFirst = async args => {
    assert.deepEqual(args.where, { id: 'foreign', tenantId: 'tenant-a' });
    return null;
  };
  assert.equal((await request('/foreign/join', 'POST')).status, 404);
});

test('teachers cannot create sessions and cannot start without a grant', async () => {
  db.user.findUnique = async () => actor('professor');
  assert.equal((await request('/', 'POST', { title: 'Test', startsAt: '2026-10-17T12:00:00Z', endsAt: '2026-10-17T13:00:00Z' })).status, 403);
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: 'course-a', status: 'scheduled' });
  assert.equal((await request('/room-a/start', 'POST')).status, 403);
});

test('scheduled class cannot issue token to student, and lists are tenant-scoped', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: 'course-a', classGroupId: 'class-a', status: 'scheduled' });
  assert.equal((await request('/room-a/join', 'POST')).status, 409);
  db.courseEntitlement.findMany = async () => [];
  db.course.findFirst = async () => ({ id: 'course-a', paidContent: false });
  db.liveSession.findMany = async args => {
    assert.equal(args.where.tenantId ?? args.where.AND?.[0]?.tenantId, 'tenant-a');
    return [];
  };
  const list = await request('/');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body, { items: [] });
});

test('student not in the class cannot join a live room', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: 'course-a', classGroupId: 'class-a', status: 'live', endsAt: new Date(Date.now() + 3600000) });
  db.classGroup.findFirst = async args => { assert.equal(args.where.tenantId, 'tenant-a'); assert.deepEqual(args.where.memberIds, { has: 'user-a' }); return null; };
  assert.equal((await request('/room-a/join', 'POST')).status, 403);
});

test('room start fails closed without private-room configuration and does not write state', async () => {
  db.user.findUnique = async () => actor('coord');
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: 'course-a', status: 'scheduled', startsAt: new Date(), endsAt: new Date(Date.now() + 3600000) });
  db.liveSession.updateMany = async () => { throw new Error('start must not modify the session without safe LiveKit config'); };
  assert.equal((await request('/room-a/start', 'POST')).status, 503);
});

test('ending state rejects joins before a token is minted', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.liveSession.findFirst = async () => ({ id: 'room-a', courseId: null, classGroupId: null, status: 'ending' });
  assert.equal((await request('/room-a/join', 'POST')).status, 409);
});

test('student session list filters authorized course and class before the database limit', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.courseEntitlement.findMany = async () => [{ courseId: 'paid-course-a' }];
  db.course.findFirst = async () => ({ id: 'course-a', paidContent: false });
  let queries = 0;
  db.liveSession.findMany = async args => {
    queries++;
    const scope = args.where.AND?.[0] ?? args.where;
    assert.equal(scope.tenantId, 'tenant-a');
    assert.deepEqual(scope.OR[1].courseId.in.sort(), ['course-a', 'paid-course-a']);
    assert.equal(scope.OR[1].OR[1].classGroup.memberIds.has, 'user-a');
    assert.equal(args.select.rooms.where.memberIds.has, 'user-a');
    return [];
  };
  assert.equal((await request('/')).status, 200);
  assert.equal(queries, 3);
});

test('coordinator list includes transitional rooms for start/end recovery', async () => {
  db.user.findUnique = async () => actor('coord');
  let queries = 0;
  db.liveSession.findMany = async args => {
    queries++;
    assert.equal(args.where.tenantId ?? args.where.AND?.[0]?.tenantId, 'tenant-a');
    if (args.where.status?.in) {
      assert.deepEqual(args.where.status.in, ['live', 'starting', 'ending']);
      return [{ id: 'starting-a', status: 'starting' }, { id: 'ending-a', status: 'ending' }];
    }
    return [];
  };
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items.map(item => item.status), ['starting', 'ending']);
  assert.equal(queries, 3);
});

test('new class session snapshots members into bounded deterministic rooms without exposing rosters', async () => {
  db.user.findUnique = async () => actor('coord');
  db.course.findFirst = async () => ({ id: 'course-a' });
  db.classGroup.findFirst = async () => ({ courseId: 'course-a', memberIds: Array.from({ length: 101 }, (_, i) => `student-${100 - i}`) });
  db.user.findMany = async args => {
    assert.equal(args.where.tenantId, 'tenant-a');
    assert.equal(args.where.courseId, 'course-a');
    assert.equal(args.where.role, 'aluno');
    assert.equal(args.where.disabledAt, null);
    return args.where.id.in.map(id => ({ id }));
  };
  db.liveSession.create = async args => {
    assert.equal(args.data.roomSize, 30);
    assert.equal(args.data.rooms.create.length, 4);
    assert.deepEqual(args.data.rooms.create.map(room => room.memberIds.length), [30, 30, 30, 11]);
    assert.equal(args.data.rooms.create[0].memberIds[0], 'student-0');
    return { id: 'session-a', roomSize: 30, rooms: args.data.rooms.create.map((room, i) => ({ ...room, id: `room-${i}`, facilitatorId: null })) };
  };
  const response = await request('/', 'POST', { title: 'Aula', startsAt: '2026-10-17T12:00:00Z', endsAt: '2026-10-17T13:00:00Z', courseId: 'course-a', classGroupId: 'class-a' });
  assert.equal(response.status, 201);
  assert.equal(response.body.roomCount, 4);
  assert.equal(response.body.rooms[0].participantCount, 30);
  assert.equal(JSON.stringify(response.body).includes('student-0'), false);
});

test('scheduling requires class and rejects invalid room capacity', async () => {
  db.user.findUnique = async () => actor('coord');
  const base = { title: 'Aula', startsAt: '2026-10-17T12:00:00Z', endsAt: '2026-10-17T13:00:00Z' };
  assert.equal((await request('/', 'POST', base)).status, 400);
  db.course.findFirst = async () => ({ id: 'course-a' });
  db.classGroup.findFirst = async () => ({ courseId: 'course-a', memberIds: ['student-1'] });
  assert.equal((await request('/', 'POST', { ...base, courseId: 'course-a', classGroupId: 'class-a', roomSize: 51 })).status, 400);
});

test('only eligible active students are snapshotted into rooms', async () => {
  db.user.findUnique = async () => actor('coord');
  db.course.findFirst = async () => ({ id: 'course-a' });
  db.classGroup.findFirst = async () => ({ courseId: 'course-a', memberIds: ['valid', 'disabled', 'foreign', 'teacher'] });
  db.user.findMany = async args => {
    assert.deepEqual(args.where.id.in, ['valid', 'disabled', 'foreign', 'teacher']);
    assert.equal(args.where.role, 'aluno');
    assert.equal(args.where.disabledAt, null);
    return [{ id: 'valid' }];
  };
  db.liveSession.create = async args => {
    assert.deepEqual(args.data.rooms.create[0].memberIds, ['valid']);
    return { id: 'session-a', roomSize: 30, rooms: [{ id: 'room-a', label: 'Sala 1', memberIds: ['valid'], facilitatorId: null }] };
  };
  assert.equal((await request('/', 'POST', { title: 'Aula', startsAt: '2026-10-17T12:00:00Z', endsAt: '2026-10-17T13:00:00Z', courseId: 'course-a', classGroupId: 'class-a' })).status, 201);
});

test('coordinator may clear a facilitator before the session starts', async () => {
  db.user.findUnique = async () => actor('coord');
  const session = { id: 'session-a', status: 'scheduled', courseId: 'course-a', updatedAt: new Date('2026-10-16T10:00:00Z'), rooms: [{ id: 'room-a', label: 'Sala 1', memberIds: ['student-a'], facilitatorId: 'teacher-a' }] };
  db.liveSession.findFirst = async () => session;
  db.$transaction = async callback => callback({
    liveSession: {
      updateMany: async args => { assert.equal(args.where.updatedAt, session.updatedAt); assert.equal(args.where.status, 'scheduled'); return { count: 1 }; },
      findFirst: async () => session,
    },
    liveRoom: { update: async args => { assert.deepEqual(args.where, { id: 'room-a' }); assert.deepEqual(args.data, { facilitatorId: null }); return {}; } },
  });
  const response = await request('/session-a/rooms/room-a', 'PATCH', { facilitatorId: null });
  assert.equal(response.status, 200);
});

test('concurrent start prevents stale facilitator changes', async () => {
  db.user.findUnique = async () => actor('coord');
  db.liveSession.findFirst = async () => ({ id: 'session-a', status: 'scheduled', courseId: 'course-a', updatedAt: new Date('2026-10-16T10:00:00Z'), rooms: [{ id: 'room-a', label: 'Sala 1', memberIds: [], facilitatorId: 'teacher-a' }] });
  db.$transaction = async callback => callback({ liveSession: { updateMany: async () => ({ count: 0 }) } });
  assert.equal((await request('/session-a/rooms/room-a', 'PATCH', { facilitatorId: null })).status, 409);
});

test('teacher with live.manage cannot start or end every room', async () => {
  db.user.findUnique = async () => actor('professor', { permissions: ['live.manage'] });
  db.liveSession.findFirst = async () => ({ id: 'session-a', status: 'scheduled', courseId: 'course-a' });
  assert.equal((await request('/session-a/start', 'POST')).status, 403);
  assert.equal((await request('/session-a/end', 'POST')).status, 403);
});

test('student list reveals only assigned room, not other rosters or facilitators', async () => {
  db.user.findUnique = async () => actor('aluno');
  db.courseEntitlement.findMany = async () => [];
  db.course.findFirst = async () => ({ id: 'course-a', paidContent: false });
  db.liveSession.findMany = async args => args.where.status?.in ? [{ id: 'session-a', status: 'live', rooms: [
    { id: 'one', label: 'Sala 1', memberIds: ['user-a'], facilitatorId: 'teacher-a' },
    { id: 'two', label: 'Sala 2', memberIds: ['other-student'], facilitatorId: 'teacher-b' },
  ] }] : [];
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.equal(response.body.items[0].myRoomId, 'one');
  assert.equal('rooms' in response.body.items[0], false);
  assert.equal(JSON.stringify(response.body).includes('other-student'), false);
});

test('coordinator cannot start a session with rooms lacking facilitators', async () => {
  db.user.findUnique = async () => actor('coord');
  db.liveSession.findFirst = async () => ({ id: 'session-a', status: 'scheduled', courseId: 'course-a', rooms: [{ id: 'room-a', facilitatorId: null }], startsAt: new Date(), endsAt: new Date(Date.now() + 3600000) });
  const previous = { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET, auto: process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED };
  process.env.LIVEKIT_URL = 'wss://live.example.invalid'; process.env.LIVEKIT_API_KEY = 'key'; process.env.LIVEKIT_API_SECRET = 'secret'; process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED = 'true';
  try { assert.equal((await request('/session-a/start', 'POST')).status, 409); }
  finally {
    for (const [key, value] of Object.entries({ LIVEKIT_URL: previous.url, LIVEKIT_API_KEY: previous.key, LIVEKIT_API_SECRET: previous.secret, LIVEKIT_ROOM_AUTO_CREATE_DISABLED: previous.auto })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('a stale start cannot mark live after a newer retry claimed the session', async () => {
  db.user.findUnique = async () => actor('coord');
  const previous = { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET, auto: process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED };
  const originalListRooms = RoomServiceClient.prototype.listRooms;
  const originalCreateRoom = RoomServiceClient.prototype.createRoom;
  const originalDeleteRoom = RoomServiceClient.prototype.deleteRoom;
  process.env.LIVEKIT_URL = 'wss://live.example.invalid'; process.env.LIVEKIT_API_KEY = 'key'; process.env.LIVEKIT_API_SECRET = 'secret'; process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED = 'true';
  let createdName;
  let cleanedName;
  RoomServiceClient.prototype.listRooms = async names => { createdName = names[0]; return []; };
  RoomServiceClient.prototype.createRoom = async () => ({});
  RoomServiceClient.prototype.deleteRoom = async name => { cleanedName = name; return {}; };
  const session = { id: 'session-a', tenantId: 'tenant-a', status: 'scheduled', courseId: 'course-a', classGroupId: 'class-a', roomSize: 30, updatedAt: new Date(Date.now() - 1000), startsAt: new Date(), endsAt: new Date(Date.now() + 3600000), rooms: [{ id: 'room-a', facilitatorId: 'teacher-a' }] };
  db.liveSession.findFirst = async () => session;
  db.user.count = async () => 1;
  db.classGroup.findFirst = async () => ({ id: 'class-a' });
  let claimVersion;
  db.liveSession.updateMany = async args => {
    if (args.data.status === 'starting') { claimVersion = args.data.updatedAt; assert.equal(args.where.updatedAt, session.updatedAt); return { count: 1 }; }
    assert.equal(args.data.status, 'live');
    assert.equal(args.where.updatedAt, claimVersion);
    return { count: 0 }; // A newer retry has already changed updatedAt.
  };
  try {
    assert.equal((await request('/session-a/start', 'POST')).status, 409);
    const expected = 'facilita_' + createHash('sha256').update(`tenant-a:session-a:room-a:${claimVersion.toISOString()}`).digest('hex').slice(0, 40);
    assert.equal(createdName, expected);
    assert.equal(cleanedName, expected);
  }
  finally {
    RoomServiceClient.prototype.listRooms = originalListRooms;
    RoomServiceClient.prototype.createRoom = originalCreateRoom;
    RoomServiceClient.prototype.deleteRoom = originalDeleteRoom;
    for (const [key, value] of Object.entries({ LIVEKIT_URL: previous.url, LIVEKIT_API_KEY: previous.key, LIVEKIT_API_SECRET: previous.secret, LIVEKIT_ROOM_AUTO_CREATE_DISABLED: previous.auto })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('a failed stale start cannot reset a newer retry to scheduled', async () => {
  db.user.findUnique = async () => actor('coord');
  const previous = { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET, auto: process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED };
  const originalListRooms = RoomServiceClient.prototype.listRooms;
  const originalDeleteRoom = RoomServiceClient.prototype.deleteRoom;
  process.env.LIVEKIT_URL = 'wss://live.example.invalid'; process.env.LIVEKIT_API_KEY = 'key'; process.env.LIVEKIT_API_SECRET = 'secret'; process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED = 'true';
  RoomServiceClient.prototype.listRooms = async () => { throw new Error('transport failed'); };
  RoomServiceClient.prototype.deleteRoom = async () => ({});
  const session = { id: 'session-a', tenantId: 'tenant-a', status: 'scheduled', courseId: 'course-a', classGroupId: 'class-a', roomSize: 30, updatedAt: new Date(Date.now() - 1000), startsAt: new Date(), endsAt: new Date(Date.now() + 3600000), rooms: [{ id: 'room-a', facilitatorId: 'teacher-a' }] };
  db.liveSession.findFirst = async () => session;
  db.user.count = async () => 1;
  db.classGroup.findFirst = async () => ({ id: 'class-a' });
  let claimVersion;
  db.liveSession.updateMany = async args => {
    if (args.data.status === 'starting') { claimVersion = args.data.updatedAt; return { count: 1 }; }
    assert.equal(args.data.status, 'scheduled');
    assert.equal(args.where.updatedAt, claimVersion);
    return { count: 0 }; // A newer retry owns the transition.
  };
  try { assert.equal((await request('/session-a/start', 'POST')).status, 503); }
  finally {
    RoomServiceClient.prototype.listRooms = originalListRooms;
    RoomServiceClient.prototype.deleteRoom = originalDeleteRoom;
    for (const [key, value] of Object.entries({ LIVEKIT_URL: previous.url, LIVEKIT_API_KEY: previous.key, LIVEKIT_API_SECRET: previous.secret, LIVEKIT_ROOM_AUTO_CREATE_DISABLED: previous.auto })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('ending closes only the live generation, never a stale start generation', async () => {
  db.user.findUnique = async () => actor('coord');
  const previous = { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET, auto: process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED };
  const originalDeleteRoom = RoomServiceClient.prototype.deleteRoom;
  process.env.LIVEKIT_URL = 'wss://live.example.invalid'; process.env.LIVEKIT_API_KEY = 'key'; process.env.LIVEKIT_API_SECRET = 'secret'; process.env.LIVEKIT_ROOM_AUTO_CREATE_DISABLED = 'true';
  const liveGeneration = new Date('2026-10-16T10:02:00Z');
  db.liveSession.findFirst = async () => ({ id: 'session-a', tenantId: 'tenant-a', status: 'live', courseId: 'course-a', startedAt: liveGeneration, rooms: [{ id: 'room-a', label: 'Sala 1', memberIds: [], facilitatorId: 'teacher-a' }] });
  db.liveSession.updateMany = async () => ({ count: 1 });
  let deletedName;
  RoomServiceClient.prototype.deleteRoom = async name => { deletedName = name; return {}; };
  try {
    assert.equal((await request('/session-a/end', 'POST')).status, 200);
    const current = 'facilita_' + createHash('sha256').update(`tenant-a:session-a:room-a:${liveGeneration.toISOString()}`).digest('hex').slice(0, 40);
    const stale = 'facilita_' + createHash('sha256').update('tenant-a:session-a:room-a:2026-10-16T10:00:00.000Z').digest('hex').slice(0, 40);
    assert.equal(deletedName, current);
    assert.notEqual(deletedName, stale);
  }
  finally {
    RoomServiceClient.prototype.deleteRoom = originalDeleteRoom;
    for (const [key, value] of Object.entries({ LIVEKIT_URL: previous.url, LIVEKIT_API_KEY: previous.key, LIVEKIT_API_SECRET: previous.secret, LIVEKIT_ROOM_AUTO_CREATE_DISABLED: previous.auto })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
