const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createChangePasswordHandler } = require('../dist/controllers/change-password');

const invoke = async ({ role = 'superadmin', storedRole = 'superadmin', newPassword = 'Example9!', confirmPassword = newPassword, replaceResult = true } = {}) => {
  let writes = 0;
  let newHash;
  const previousHash = await bcrypt.hash('Previous9!', 4);
  const handler = createChangePasswordHandler({
    find: async id => ({ id, role: storedRole, password: previousHash }),
    replace: async (id, previous, hash) => {
      assert.equal(id, 'self'); assert.equal(previous, previousHash);
      writes++; newHash = hash; return replaceResult;
    }
  });
  const res = { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ user: { id: 'self', role }, body: { newPassword, confirmPassword } }, res);
  return { res, writes, newHash };
};
test('changes only the signed-in account, storing a bcrypt hash without requiring current password', async () => {
  const { res, writes, newHash } = await invoke();
  assert.equal(res.code, 200); assert.equal(writes, 1);
  assert.notEqual(newHash, 'Example9!'); assert.equal(await bcrypt.compare('Example9!', newHash), true);
  assert.deepEqual(Object.keys(res.body), ['message']);
});
test('rejects other roles and stale superadmin role claims', async () => {
  for (const args of [{ role: 'coord' }, { role: 'professor' }, { storedRole: 'aluno' }]) {
    const { res, writes } = await invoke(args); assert.equal(res.code, 403); assert.equal(writes, 0);
  }
});
test('rejects confirmation mismatch and passwords outside the policy', async () => {
  for (const args of [{ confirmPassword: 'different' }, { newPassword: 'short1!' }, { newPassword: 'Password123' }, { newPassword: 'Ab1!' + 'x'.repeat(69) }, { newPassword: 'Previous9!' }]) {
    const { res, writes } = await invoke(args); assert.equal(res.code, 400); assert.equal(writes, 0);
  }
});
test('does not overwrite a concurrently changed password', async () => {
  const { res } = await invoke({ replaceResult: false }); assert.equal(res.code, 409);
});
