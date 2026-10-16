import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../src', import.meta.url));
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : /\.(tsx?|mjs)$/.test(entry.name) ? [path.join(directory, entry.name)] : []);

test('runtime panels do not ship historical demo people, lessons or fabricated avatars', () => {
  const forbidden = [/i\.pravatar\.cc/, /Semiologia Geral/, /Fisiologia Humana/, /UNIFAN/, /Mariana Santos/, /les_1/, /facilita_completed_modules/];
  for (const file of files(root)) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of forbidden) assert.ok(!pattern.test(source), path.relative(root, file) + ': ' + pattern);
  }
});
test('dashboard visualizations and certificates do not fabricate measurements or authenticity codes', () => {
  for (const file of ['components/Charts.tsx', 'components/DonutChart.tsx', 'components/CertificateModal.tsx']) assert.ok(!/Math\.random/.test(readFileSync(path.join(root, file), 'utf8')), file);
  const source = readFileSync(path.join(root, 'pages/superadmin/SuperAdminCourses.tsx'), 'utf8');
  assert.ok(!/\.previstos|\.adesao|\.alunos/.test(source));
  assert.match(source, /_count/);
  assert.match(source, /const activeTenants = tenants\.filter\(tenant => tenant\.ativo\)/);
  assert.match(source, /const allCourses = activeTenants\.flatMap/);
});
