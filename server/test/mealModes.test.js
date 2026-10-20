// Meal modes (handoff 6.2). The model is mocked; these tests make no API calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMinutes, checkModes, soonToExpire, HELD_BACK, NOTES } from '../src/agents/mealModes.js';
import { fridgeCoverage } from '../src/tools/fridge.js';
import { planMeals } from '../src/agents/mealPlanner.js';
import { newTrace } from '../src/llm.js';

const meal = (type, name, ings, extra = {}) => ({
  type, name, recipe: 'Step 1: Cook.', calories: 500, protein: 30, carbs: 50, fat: 15, prepTime: '15 min',
  ingredients: ings.map(([n, q, u]) => `${q}${u} ${n}`),
  structuredIngredients: ings.map(([name, quantity, unit]) => ({ name, quantity, unit })),
  missingIngredients: [], ...extra,
});

test('prep time parsing', () => {
  assert.equal(parseMinutes('20 min'), 20);
  assert.equal(parseMinutes('15 minutes'), 15);
  assert.equal(parseMinutes('1 hr 10 min'), 70);
  assert.equal(parseMinutes('25-30 min'), 30);
  assert.equal(parseMinutes('quick'), null);
  assert.equal(parseMinutes('—'), null);
});

test('quantities are compared within a unit family; a mismatch is unverified, not enough', () => {
  const fridge = [{ name: 'chicken breast', quantity: '0.5', unit: 'kg' }, { name: 'egg', quantity: '6', unit: 'piece' }, { name: 'milk', quantity: '1', unit: 'L' }];
  const c = fridgeCoverage(fridge, [
    { name: 'chicken breast', quantity: 300, unit: 'g' },
    { name: 'chicken breast', quantity: 300, unit: 'g' }, // two lines on one row are added up: 600 g > 500 g
    { name: 'egg', quantity: 100, unit: 'g' },
    { name: 'milk', quantity: 200, unit: 'ml' },
  ]);
  assert.deepEqual(c.short, ['chicken breast (need 600 g, have 500 g)']);
  assert.deepEqual(c.unverified, ['egg']);
});

test('Feeling hungry: over 20 minutes or more than 2 to buy fails', () => {
  const { meals } = checkModes([
    meal('Lunch', 'Fast', [['tofu', 100, 'g']]),
    meal('Dinner', 'Slow', [['tofu', 100, 'g']], { prepTime: '35 min' }),
    meal('Breakfast', 'Shopping', [['tofu', 100, 'g']], { missingIngredients: ['a', 'b', 'c'] }),
  ], { mode: 'hungry', profile: {}, fridge: [], today: '2026-10-22', fullDay: true });
  assert.deepEqual(meals.map((m) => m.modeViolations.length), [0, 1, 1]);
  assert.match(meals[1].modeViolations[0], /35 minutes/);
  assert.deepEqual(meals[2].modeEvidence, { prepMinutes: 15, toBuy: 3 });
});

test('Feeling healthy: calories within +/-20%; skipped without a target', () => {
  const ms = [meal('Lunch', 'Ok', [], { calories: 560 }), meal('Dinner', 'Big', [], { calories: 800 })];
  assert.deepEqual(checkModes(ms, { mode: 'healthy', profile: { approxCaloriesPerMeal: 600 }, fridge: [], today: '2026-10-22' }).meals.map((m) => m.modeViolations.length), [0, 1]);
  assert.deepEqual(checkModes(ms, { mode: 'healthy', profile: { approxCaloriesPerMeal: null }, fridge: [], today: '2026-10-22' }).meals.map((m) => m.modeViolations.length), [0, 0]);
});

const dated = [
  { name: 'spinach', quantity: '200', unit: 'g', expiry: '2026-10-22' },
  { name: 'mushroom', quantity: '150', unit: 'g', expiry: '2026-10-23' },
  { name: 'bell pepper', quantity: '3', unit: 'piece', expiry: '2026-10-24' },
  { name: 'zucchini', quantity: '2', unit: 'piece', expiry: '2026-10-25' },
  { name: 'tofu', quantity: '400', unit: 'g', expiry: '2026-11-10' },
  { name: 'rice', quantity: '1000', unit: 'g', expiry: 'soon' },
];

test('Clean out: soon-to-expire items are today to 3 days out, soonest first', () => {
  assert.deepEqual(soonToExpire(dated, '2026-10-22').map((r) => r.name), ['spinach', 'mushroom', 'bell pepper', 'zucchini']);
});

test('Clean out: four expiring items need at least three used across the day', () => {
  const ctx = { mode: 'cleanOut', profile: {}, fridge: dated, today: '2026-10-22', fullDay: true };
  const good = checkModes([
    meal('Breakfast', 'Omelette', [['spinach', 100, 'g']]),
    meal('Lunch', 'Bowl', [['mushroom', 100, 'g'], ['rice', 100, 'g']]),
    meal('Dinner', 'Stir fry', [['bell pepper', 2, 'piece']]),
  ], ctx);
  assert.ok(good.meals.every((m) => m.modeViolations.length === 0));
  assert.deepEqual(good.meals[1].modeEvidence.soonUsed, ['mushroom']);

  const bad = checkModes([
    meal('Breakfast', 'Omelette', [['spinach', 100, 'g']]),
    meal('Lunch', 'Rice bowl', [['rice', 100, 'g']]),
    meal('Dinner', 'Tofu', [['tofu', 100, 'g']], { missingIngredients: ['lemon (1 piece)'] }),
  ], ctx);
  assert.equal(bad.meals[0].modeViolations.length, 0, 'the meal that already uses one is left alone');
  assert.match(bad.meals[1].modeViolations[0], /uses 1 .* needs 3/);
  assert.equal(bad.meals[2].modeViolations.length, 2, 'non-staple shopping plus the expiry target');
});

test('Clean out: notes when nothing is dated soon, or nothing is dated at all', () => {
  const ms = [meal('Lunch', 'Bowl', [['rice', 100, 'g']])];
  assert.equal(checkModes(ms, { mode: 'cleanOut', profile: {}, fridge: [dated[4]], today: '2026-10-22', fullDay: false }).note, NOTES.noneSoon);
  assert.equal(checkModes(ms, { mode: 'cleanOut', profile: {}, fridge: [dated[5]], today: '2026-10-22', fullDay: false }).note, NOTES.noDates);
});

test('a mode failure shares the single repair round and is held back with Sara\'s message', async () => {
  let repairs = 0;
  const slow = meal('Dinner', 'Slow roast', [['tofu', 200, 'g']], { prepTime: '45 min' });
  const deps = {
    runAgent: async () => ({ meals: [slow] }),
    jsonCompletion: async () => { repairs += 1; return { meals: [{ ...slow, name: 'Still slow' }] }; },
  };
  const trace = newTrace('meals');
  const out = await planMeals({ fridge: dated, profile: { diet: 'No Restriction' }, neededTypes: ['Dinner'], mode: 'hungry', today: '2026-10-22', useLibrary: false, trace }, deps);
  assert.equal(repairs, 1);
  assert.equal(out.meals.length, 0);
  assert.deepEqual(out.blocked, [{ type: 'Dinner', reason: HELD_BACK.hungry }]);
  assert.equal(out.mode, 'hungry');
  assert.ok(trace.flags.includes('mode_repair'));
});

test('without a mode, no mode rules apply (older callers and the original eval cases)', async () => {
  const slow = meal('Dinner', 'Slow roast', [['tofu', 200, 'g']], { prepTime: '45 min' });
  const deps = { runAgent: async () => ({ meals: [slow] }), jsonCompletion: async () => assert.fail('no repair expected') };
  const out = await planMeals({ fridge: dated, profile: {}, neededTypes: ['Dinner'], useLibrary: false }, deps);
  assert.equal(out.meals.length, 1);
});

test('Clean out only counts expiring food the user can eat', () => {
  const fridge = [
    { name: 'bacon', quantity: '6', unit: 'piece', expiry: '2026-10-22' },
    { name: 'shrimp', quantity: '200', unit: 'g', expiry: '2026-10-23' },
    { name: 'spinach', quantity: '200', unit: 'g', expiry: '2026-10-23' },
  ];
  assert.deepEqual(soonToExpire(fridge, '2026-10-22', { diet: 'Vegetarian' }).map((r) => r.name), ['spinach']);
  assert.deepEqual(soonToExpire(fridge, '2026-10-22', { diet: 'No Restriction', allergies: ['Shellfish'] }).map((r) => r.name), ['bacon', 'spinach']);
});
