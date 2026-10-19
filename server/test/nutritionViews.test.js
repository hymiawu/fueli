// The app's per 100 g / per serving / whole package helper (lib/nutrition.js, handoff 6.1.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toView, fromView, caloriesPerServing, viewFactor, toBaseQuantity } from '../../lib/nutrition.js';

test('hot pot label: 200 kcal per 100 g, 365 g serving, 1 per package', () => {
  const base = { calories: '200', protein: '5', carbs: '20', fat: '11' };
  assert.equal(toView(base, 'per100', '365', '1').calories, '200');
  assert.equal(toView(base, 'serving', '365', '1').calories, '730');
  assert.equal(toView(base, 'package', '365', '1').calories, '730');
});

test('editing per serving writes back to an unrounded per 100 g base', () => {
  const per100 = fromView('700', 'serving', '365', '1');
  assert.equal(toView({ calories: per100 }, 'per100', '365', '1').calories, '192');
  assert.equal(caloriesPerServing({ calories: String(per100), serving_size: '365' }), 700);
});

test('views without a serving size are unavailable', () => {
  assert.equal(viewFactor('serving', '', ''), null);
  assert.equal(viewFactor('package', '30', ''), null);
  assert.equal(toView({ calories: '100' }, 'serving', '', '').calories, '');
  assert.equal(caloriesPerServing({ calories: '100' }), null);
});

test('kg and L enter the maths as 1000 g and 1000 ml', () => {
  assert.deepEqual(toBaseQuantity('1.5', 'kg'), { amount: 1500, unit: 'g' });
  assert.deepEqual(toBaseQuantity('1', 'L'), { amount: 1000, unit: 'ml' });
});
