const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isLessonLocked, isFinalExamLocked } = require('../dist/controllers/learning-path-policy');

test('aluno desbloqueia somente a próxima aula em ordem', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(isLessonLocked(0, ids, new Set(), 'aluno'), false);
  assert.equal(isLessonLocked(1, ids, new Set(), 'aluno'), true);
  assert.equal(isLessonLocked(1, ids, new Set(['a']), 'aluno'), false);
  assert.equal(isLessonLocked(2, ids, new Set(['a']), 'aluno'), true);
  assert.equal(isLessonLocked(2, ids, new Set(['a', 'b']), 'aluno'), false);
  // After reordering, completing only the immediately previous item must not skip a gap.
  assert.equal(isLessonLocked(2, ids, new Set(['b']), 'aluno'), true);
  assert.equal(isLessonLocked(2, ids, new Set(['a']), 'aluno'), true);
  assert.equal(isLessonLocked(2, ids, new Set(), 'coord'), false);
});

test('prova final exige todas as aulas ativas; editor não fica bloqueado', () => {
  const ids = ['a', 'b'];
  assert.equal(isFinalExamLocked(ids, new Set(['a']), 'aluno'), true);
  assert.equal(isFinalExamLocked(ids, new Set(ids), 'aluno'), false);
  assert.equal(isFinalExamLocked(ids, new Set(), 'professor'), false);
});
