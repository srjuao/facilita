const { test } = require('node:test');
const assert = require('node:assert/strict');
const { updateTenantUser } = require('../dist/controllers/tenant.controller');
const valid = { nome: 'Pessoa de Teste', email: 'pessoa@example.test', role: 'coord', courseId: null };
const invoke = async (body, role = 'superadmin') => {
  const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await updateTenantUser({ user: { id: 'operator', role }, params: { id: 'tenant', userId: 'member' }, body }, res);
  return res;
};
test('rejects unauthenticated requests and non-superadmins before database access', async () => {
  for (const role of ['coord', 'professor', 'aluno', undefined]) {
    const res = role === undefined ? { code: 200, status(code) { this.code = code; return this; }, json() { return this; } } : await invoke(valid, role);
    if (role === undefined) await updateTenantUser({ body: valid }, res);
    assert.equal(res.code, 403);
  }
});
test('rejects invalid account data and attempts to grant global superadmin', async () => {
  for (const overrides of [{ nome: '' }, { email: 'invalid' }, { role: 'superadmin' }, { role: 'unexpected' }, { courseId: {} }]) assert.equal((await invoke({ ...valid, ...overrides })).code, 400);
});
test('rejects weak and oversized passwords before database access', async () => {
  for (const password of ['short1!', 'NoSpecial123', { malicious: true }, 'Long123!' + 'x'.repeat(73)]) assert.equal((await invoke({ ...valid, password })).code, 400);
});
