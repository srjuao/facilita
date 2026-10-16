import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice as quote, validPricePoints } from '../src/pricing.mjs';
// Approved commercial policy is test fixture data, never a runtime fallback.
const PRICE_POINTS = [{ students: 20, unitCents: 5790 }, { students: 50, unitCents: 3490 }, { students: 100, unitCents: 2290 }, { students: 250, unitCents: 1290 }, { students: 500, unitCents: 790 }, { students: 1000, unitCents: 430 }];
const calculatePrice = students => quote(students, PRICE_POINTS);

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
  for (const n of [-1, 1.5, NaN, Infinity, 1000001, '20', null]) assert.throws(() => calculatePrice(n), RangeError);
});

test('uses arbitrary catalog prices instead of embedded commercial constants', () => {
  const custom = [{ students: 10, unitCents: 2000 }, { students: 100, unitCents: 500 }];
  assert.equal(quote(0, custom).totalCents, 0);
  assert.equal(quote(10, custom).totalCents, 20000);
  assert.equal(quote(1000, custom).totalCents, 500000);
  assert.equal(quote(55, custom).totalCents, 35000);
});
test('fails closed when catalog data is missing or violates the pricing curve', () => {
  for (const points of [undefined, [], [{ students: 1, unitCents: 100 }], [{ students: 10, unitCents: 100 }, { students: 20, unitCents: 101 }], [{ students: 10, unitCents: 100 }, { students: 20, unitCents: 10 }]]) {
    assert.equal(validPricePoints(points), false);
    assert.throws(() => quote(10, points), RangeError);
  }
});
