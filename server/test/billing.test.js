import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requirePaid } from '../src/billing.js';

// Minimal stand-ins for the Supabase query chain and Express response.
const reqWith = (row) => ({
  user: { id: 'u1' },
  db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) },
});
const run = async (row) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json() { return this; } };
  let passed = false;
  await requirePaid(reqWith(row), res, () => { passed = true; });
  return passed ? 'next' : res.code;
};

test('paywall lets active, trialing and grandfathered accounts through', async () => {
  for (const status of ['active', 'trialing', 'grandfathered']) assert.equal(await run({ status }), 'next');
});

test('paywall blocks accounts without an active subscription', async () => {
  assert.equal(await run(null), 402);
  for (const status of ['incomplete', 'past_due', 'canceled', 'unpaid']) assert.equal(await run({ status }), 402);
});
