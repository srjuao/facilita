const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUpdateProfileHandler } = require('../dist/controllers/update-profile');

const invoke = async ({ role = 'superadmin', storedRole = 'superadmin', exists = true, body = { nome: '  Maria Silva  ', email: '  MARIA@EXAMPLE.COM  ' }, replaceResult = true, writeError } = {}) => {
  const writes = [];
  const handler = createUpdateProfileHandler({
    find: async id => { assert.equal(id, 'self'); return exists ? { id, role: storedRole } : null; },
    replace: async (id, profile) => { writes.push({ id, profile }); if (writeError) throw writeError; return replaceResult; }
  });
  const res = { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ user: { id: 'self', role }, body }, res);
  return { res, writes };
};

test('updates only the signed-in profile, normalizing the email and returning a safe DTO', async () => {
  const { res, writes } = await invoke();
  assert.equal(res.code, 200);
  assert.deepEqual(writes, [{ id: 'self', profile: { nome: 'Maria Silva', email: 'maria@example.com' } }]);
  assert.deepEqual(res.body.user, { id: 'self', nome: 'Maria Silva', email: 'maria@example.com' });
  assert.equal(JSON.stringify(res.body).includes('password'), false);
});

test('denies non-admin and stale or removed superadmin accounts without writes', async () => {
  for (const args of [{ role: 'coord' }, { role: 'aluno' }, { role: 'professor' }, { storedRole: 'coord' }, { exists: false }]) {
    const { res, writes } = await invoke(args);
    assert.equal(res.code, 403); assert.equal(writes.length, 0);
  }
});

test('rejects profile injection, invalid names and invalid emails', async () => {
  const valid = { nome: 'Maria', email: 'maria@example.com' };
  for (const body of [null, [], {}, { ...valid, id: 'another' }, { ...valid, role: 'aluno' }, { ...valid, papel: 'Admin' }, { ...valid, tenantId: 'another' }, { ...valid, password: 'secret' }, { ...valid, nome: ' ' }, { ...valid, nome: 'x'.repeat(121) }, { ...valid, nome: 'Maria\nSilva' }, { ...valid, email: 'invalid' }, { ...valid, email: 'a'.repeat(250) + '@example.com' }]) {
    const { res, writes } = await invoke({ body });
    assert.equal(res.code, 400); assert.equal(writes.length, 0);
  }
});

test('reports duplicate email including unique constraint races without exposing internal errors', async () => {
  const { res } = await invoke({ writeError: { code: 'P2002', meta: { target: ['email'] } } });
  assert.equal(res.code, 409); assert.match(res.body.error, /e-mail já está em uso/);
  assert.deepEqual(Object.keys(res.body), ['error']);
});

test('checks authorization at write time and handles persistence failure', async () => {
  assert.equal((await invoke({ replaceResult: false })).res.code, 403);
  const { res } = await invoke({ writeError: new Error('private database detail') });
  assert.equal(res.code, 500); assert.equal(JSON.stringify(res.body).includes('private'), false);
});
