import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, PRICE_POINTS } from '../src/pricing.mjs';

test('charges R$57.90 per student up to 20', () => {
  for (let n = 1; n <= 20; n++) { assert.equal(calculatePrice(n).total, n * 5790 / 100); assert.equal(calculatePrice(n).unitPrice, 57.9); }
});
test('matches all published price points and reaches the approved floor at 1000', () => {
  for (const point of PRICE_POINTS) assert.equal(calculatePrice(point.students).total, point.students * point.unitCents / 100);
  for (const n of [1000, 1001, 2000, 100000]) assert.equal(calculatePrice(n).total, n * 430 / 100);
});
test('has no price cliffs: totals never fall and average unit prices never rise', () => {
  let previous = calculatePrice(1);
  for (let n = 2; n <= 100000; n++) {
    const next = calculatePrice(n);
    assert.ok(next.total >= previous.total); assert.ok(next.unitPrice <= previous.unitPrice + 0.000001);
    assert.ok(next.unitPrice >= 4.3 - 0.000001); previous = next;
  }
});
test('rejects invalid or out-of-range student counts', () => {
  for (const n of [0, -1, 1.5, NaN, Infinity, 100001, '20', null]) assert.throws(() => calculatePrice(n), RangeError);
});
