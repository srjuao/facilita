const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
test('retired demo seed exits before database access even with a database URL', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../dist/seed/seed.js')], { env: { ...process.env, DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/never_connect', NODE_ENV: 'production' }, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Seed de demonstração desativado/);
  assert.doesNotMatch(result.stderr, /PrismaClient|Can't reach database/);
});
