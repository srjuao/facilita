import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { calculatePrice } from '../src/pricing.mjs';
const require = createRequire(import.meta.url);
const { estimatedCents } = require('../../backend/dist/controllers/plan-policy.js');

test('public simulator and billing use identical integer rounding for custom curves', () => {
  const curves = [
    [{ students: 41, unitCents: 50685 }, { students: 697, unitCents: 30966 }],
    [{ students: 1, unitCents: 100000000 }, { students: 99999, unitCents: 99999999 }],
    [{ students: 20, unitCents: 5790 }, { students: 50, unitCents: 3490 }, { students: 1000, unitCents: 430 }],
    [{ students: 5, unitCents: 0 }, { students: 10, unitCents: 0 }]
  ];
  assert.equal(calculatePrice(497, curves[0]).totalCents, 15636590);
  for (const points of curves) {
    const plan = { billingMode: 'FAIXAS', priceCents: 0, pricePoints: points };
    for (const n of [0,1,5,20,21,41,42,49,50,51,497,697,698,999,1000,1001,10000,55555,99998,99999,100000]) assert.equal(calculatePrice(n, points).totalCents, estimatedCents(plan, n), 'Mismatch at ' + n);
  }
});
