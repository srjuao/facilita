import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPriceCents, planStudentLimit } from '../src/plan-input.mjs';

test('converts plan prices to exact cents, accepting Brazilian decimal comma', () => {
  for (const [input, expected] of [['57,90',5790],['4.30',430],['0',0],['0,01',1],['1,2',120],['1000000,00',100000000],[' 22,90 ',2290]]) assert.equal(planPriceCents(input), expected);
});
test('rejects ambiguous, negative, nonfinite and oversized prices', () => {
  for (const input of ['', 'NaN', 'Infinity', '-1', '1e4', '1.000,00', '1,234', '1000000,01', '1.2.3', '1,2,3']) assert.equal(planPriceCents(input), null, input);
});
test('parses an optional student capacity without accepting fractional or unsafe limits', () => {
  assert.equal(planStudentLimit(''), null);
  assert.equal(planStudentLimit('20'), 20);
  assert.equal(planStudentLimit('1000000'), 1000000);
  for (const input of ['0','-1','1.5','1,5','1e3','1000001','Infinity']) assert.equal(planStudentLimit(input), undefined, input);
});
