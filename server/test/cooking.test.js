// Cooked deduction planning in the app (lib/cooking.js, handoff 6.2.1, D-42).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCooked, deductionRecord } from '../../lib/cooking.js';

const rows = [
  { id: 'r1', name: 'chicken breast', quantity: '100', unit: 'g', created_at: '2026-10-10T00:00:00Z', serving_size: null },
  { id: 'r2', name: 'white rice', quantity: '1', unit: 'kg', created_at: '2026-10-11T00:00:00Z' },
  { id: 'r3', name: 'egg', quantity: '6', unit: 'piece', created_at: '2026-10-12T00:00:00Z' },
];

test('two diners: totals are deducted once; a short row is used up and the rest reported as outside', () => {
  const { ops, summary } = planCooked([
    { name: 'chicken breast', quantity: 300, unit: 'g' },
    { name: 'white rice', quantity: 150, unit: 'g' },
    { name: 'rice', quantity: 50, unit: 'g' }, // merged with the line above: 200 g from one row
    { name: 'egg', quantity: 100, unit: 'g' }, // piece vs gram: listed, not deducted
    { name: 'lemon', quantity: 1, unit: 'piece' }, // not in the fridge: nothing to deduct
  ], rows);
  assert.deepEqual(ops.map((o) => [o.type, o.row.id, o.used, o.quantity]), [
    ['delete', 'r1', 100, undefined],
    ['update', 'r2', 0.2, 0.8],
  ]);
  assert.deepEqual(summary.outside, ['chicken breast: 200 g more than the fridge had']);
  assert.equal(summary.unverified.length, 1);
  assert.match(summary.unverified[0], /^egg/);
});

test('the undo record keeps the original row, id and created_at included', () => {
  const { ops } = planCooked([{ name: 'chicken breast', quantity: 300, unit: 'g' }], rows);
  const rec = deductionRecord(ops[0]);
  assert.equal(rec.wasDeleted, true);
  assert.equal(rec.used, 100);
  assert.equal(rec.originalItem.id, 'r1');
  assert.equal(rec.originalItem.created_at, '2026-10-10T00:00:00Z');
});
