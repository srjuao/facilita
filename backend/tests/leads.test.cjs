const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { validatePublicLead, validateLeadUpdate, LeadRateLimiter } = require('../dist/controllers/lead-validation');
const valid = { nome: ' Ana ', instituicao: ' Escola ', email: ' ANA@EXAMPLE.TEST ', telefone: '+55 (62) 99999-1234', consent: true, alunos: 20 };

test('normalizes public contact fields and never accepts a caller-provided stage', () => {
  const result = validatePublicLead({ ...valid, stage: 'GANHO', notas: 'override' });
  assert.deepEqual(result.data, { nome: 'Ana', instituicao: 'Escola', email: 'ana@example.test', telefone: '5562999991234', alunos: 20, mensagem: '' });
});
test('validates contact types, limits, consent and student counts', () => {
  for (const overrides of [{ nome: '' }, { nome: {} }, { instituicao: 'x'.repeat(161) }, { email: 'bad' }, { telefone: 'abcdefgh' }, { telefone: '123' }, { telefone: '1'.repeat(16) }, { alunos: 0 }, { alunos: '20' }, { alunos: 1.5 }, { alunos: 100001 }, { mensagem: 'x'.repeat(2001) }, { consent: 'true' }, { consent: false }]) assert.ok(validatePublicLead({ ...valid, ...overrides }).error, JSON.stringify(overrides));
  assert.ok(validatePublicLead(null).error);
  assert.ok(validatePublicLead([]).error);
  assert.equal(validatePublicLead({ ...valid, alunos: null }).data.alunos, null);
});
test('requires optimistic locking and restricts management fields', () => {
  const expectedUpdatedAt = '2026-10-16T12:00:00.000Z';
  assert.equal(validateLeadUpdate({ expectedUpdatedAt, stage: 'CONTATO' }).data.stage, 'CONTATO');
  assert.deepEqual(validateLeadUpdate({ expectedUpdatedAt, notas: ' Note ', email: 'overwrite' }).data, { notas: 'Note' });
  for (const body of [{ stage: 'GANHO' }, { expectedUpdatedAt }, { expectedUpdatedAt, stage: 'UNKNOWN' }, { expectedUpdatedAt, notas: 'x'.repeat(5001) }, { expectedUpdatedAt: 'nonsense', stage: 'NOVO' }]) assert.ok(validateLeadUpdate(body).error);
});
test('rate limiter expires windows and fails closed at bounded capacity', () => {
  const limiter = new LeadRateLimiter(2);
  assert.equal(limiter.allow('a', 2, 1000, 0), true);
  assert.equal(limiter.allow('a', 2, 1000, 1), true);
  assert.equal(limiter.allow('a', 2, 1000, 2), false);
  assert.equal(limiter.allow('b', 2, 1000, 2), true);
  assert.equal(limiter.allow('c', 2, 1000, 3), false);
  assert.equal(limiter.allow('a', 2, 1000, 1000), true);
  assert.equal(limiter.allow('c', 2, 1000, 1003), true);
});

// Isolate controller tests from a real database, including optimistic-update behavior.
let calls = 0;
let changed = 1;
let existing = { id: 'lead', stage: 'NOVO', updatedAt: new Date('2026-10-16T12:00:00.000Z') };
let listRows;
let listArgs;
let countArgs;
const db = {
  lead: {
    create: async ({ data }) => { calls++; return { id: 'lead', ...data }; },
    updateMany: async () => { calls++; return { count: changed }; },
    findUnique: async () => existing,
    findMany: async args => { listArgs = args; return listRows ?? [existing]; },
    count: async args => { countArgs = args; return listRows?.length ?? 1; }
  },
  $transaction: async operation => typeof operation === 'function' ? operation(db) : Promise.all(operation)
};
const originalLoad = Module._load;
let controllers;
try {
  Module._load = function (name, ...args) {
    if (name === '@prisma/client') return { PrismaClient: class { constructor() { return db; } } };
    return originalLoad.call(this, name, ...args);
  };
  controllers = require('../dist/controllers/lead.controller');
} finally { Module._load = originalLoad; }
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('public endpoint acknowledges honeypots without persisting them', async () => {
  const before = calls;
  const res = response();
  await controllers.createPublicLead({ body: { ...valid, website: 'spam.test' }, socket: { remoteAddress: 'test' } }, res);
  assert.equal(res.code, 202);
  assert.equal(calls, before);
  assert.equal(res.body.id, undefined);
});
test('public endpoint saves a valid lead without exposing lead data', async () => {
  const res = response();
  await controllers.createPublicLead({ body: valid, socket: { remoteAddress: 'test' } }, res);
  assert.equal(res.code, 201);
  assert.deepEqual(Object.keys(res.body), ['message']);
});
test('management controllers reject non-superadmins before touching the database', async () => {
  const before = calls;
  for (const role of [undefined, 'coord', 'professor', 'aluno']) {
    for (const controller of [controllers.getLeads, controllers.updateLead]) {
      const res = response();
      await controller({ user: role ? { role } : undefined }, res);
      assert.equal(res.code, 403);
    }
  }
  assert.equal(calls, before);
});
test('management returns real list envelope and optimistic-update outcomes', async () => {
  const res = response();
  await controllers.getLeads({ user: { role: 'superadmin' } }, res);
  assert.deepEqual(res.body, { items: [existing], total: 1, nextCursor: null });
  const request = { user: { role: 'superadmin' }, params: { id: 'lead' }, body: { stage: 'CONTATO', expectedUpdatedAt: '2026-10-16T12:00:00.000Z' } };
  changed = 0;
  const conflict = response();
  await controllers.updateLead(request, conflict);
  assert.equal(conflict.code, 409);
  changed = 1;
  const success = response();
  await controllers.updateLead(request, success);
  assert.equal(success.body.id, 'lead');
  existing = null;
  changed = 0;
  const missing = response();
  await controllers.updateLead(request, missing);
  assert.equal(missing.code, 404);
});
test('management paginates 100 leads with a stable cursor and searches all contact fields', async () => {
  listRows = Array.from({ length: 101 }, (_, index) => ({ id: `lead-${index}` }));
  const res = response();
  await controllers.getLeads({ user: { role: 'superadmin' }, query: { q: ' Escola ', cursor: 'previous' } }, res);
  assert.equal(res.body.items.length, 100);
  assert.equal(res.body.nextCursor, 'lead-99');
  assert.equal(res.body.total, 101);
  assert.equal(listArgs.take, 101);
  assert.equal(listArgs.skip, 1);
  assert.deepEqual(listArgs.cursor, { id: 'previous' });
  assert.deepEqual(listArgs.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(listArgs.where, { OR: ['nome', 'instituicao', 'email', 'telefone'].map(field => ({ [field]: { contains: 'Escola', mode: 'insensitive' } })) });
  assert.deepEqual(countArgs, { where: listArgs.where });
  listRows = [{ id: 'last' }];
  const last = response();
  await controllers.getLeads({ user: { role: 'superadmin' }, query: { cursor: 'lead-99' } }, last);
  assert.equal(last.body.nextCursor, null);
  listRows = undefined;
});
test('management rejects malformed search and cursors before database access', async () => {
  for (const query of [{ q: ['a', 'b'] }, { q: 'x'.repeat(201) }, { cursor: {} }, { cursor: '' }, { cursor: 'x'.repeat(129) }]) {
    const res = response();
    await controllers.getLeads({ user: { role: 'superadmin' }, query }, res);
    assert.equal(res.code, 400);
  }
});
