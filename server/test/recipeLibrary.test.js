// Recipe library and matcher (D-19). No model calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, matchRecipes, resolveIngredients } from '../src/plan/recipeMatcher.js';
import { computeMacros } from '../src/tools/nutrition.js';
import { isStaple } from '../src/tools/fridge.js';
import { checkMeal } from '../src/agents/safetyGuard.js';
import { planMeals } from '../src/agents/mealPlanner.js';

const fixed = () => 0.5; // no random variety in tests
const rows = (...r) => r.map(([name, quantity, unit, expiry]) => ({ name, quantity: String(quantity), unit, expiry: expiry ?? null }));
const textOf = (m) => [m.name, ...m.structuredIngredients.map((i) => i.name)].join(' ');

test('every recipe is priced by the nutrition database (staples aside), ids are unique, each slot has vegan options', () => {
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length);
  for (const r of RECIPES) {
    // Every name a recipe can use: fixed items, each anyOf option and each optional extra.
    const names = r.ingredients.flatMap((i) => (i.anyOf ? i.anyOf : [i]));
    assert.deepEqual(computeMacros(names).unmatched.filter((n) => !isStaple(n)), [], r.id);
    // As written for an empty fridge (first options, no extras), a serving is a real meal.
    const { calories } = computeMacros(resolveIngredients(r, []).used);
    assert.ok(calories >= 200 && calories <= 850, `${r.id}: ${calories} kcal`);
  }
  for (const type of ['Breakfast', 'Lunch', 'Dinner']) {
    const list = RECIPES.filter((r) => r.type === type);
    assert.ok(list.length >= 35, type);
    const vegan = list.filter((r) => resolveIngredients(r, [], { diet: 'Vegan' }) &&
      !checkMeal({ name: '', ingredients: [], structuredIngredients: resolveIngredients(r, [], { diet: 'Vegan' }).used, calories: 400 }, { diet: 'Vegan' }).violations.length);
    assert.ok(vegan.length >= 8, `${type}: ${vegan.length} vegan`);
  }
});

test('interchangeable ingredients follow the fridge and the diet, and name the dish', () => {
  const fried = RECIPES.find((r) => r.id === 'use-it-up-fried-rice');
  const fridge = rows(['quinoa', 500, 'g'], ['chicken breast', 400, 'g'], ['tofu', 300, 'g'], ['zucchini', 1, 'piece']);
  const omni = resolveIngredients(fried, fridge, { diet: 'No Restriction' });
  assert.equal(omni.name, 'Use-it-up tofu fried quinoa'); // first protein option in the fridge, in list order
  const veg = resolveIngredients(fried, rows(['quinoa', 500, 'g'], ['chicken breast', 400, 'g'], ['egg', 6, 'piece']), { diet: 'Vegetarian' });
  assert.equal(veg.name, 'Use-it-up egg fried quinoa');
  assert.ok(!veg.used.some((i) => i.name === 'chicken breast'));
  assert.ok(omni.used.some((i) => i.name === 'zucchini') && !omni.used.some((i) => i.name === 'spinach'));
});

test('vegetarian with chicken in the fridge, and a peanut allergy, never get those foods', () => {
  const fridge = rows(['chicken breast', 500, 'g'], ['tofu', 400, 'g'], ['spinach', 200, 'g'], ['egg', 6, 'piece'], ['brown rice', 500, 'g'], ['peanut butter', 300, 'g'], ['banana', 4, 'piece']);
  const { meals } = matchRecipes({ fridge, profile: { diet: 'Vegetarian', allergies: ['Peanuts'] }, neededTypes: ['Breakfast', 'Lunch', 'Dinner'], today: '2026-10-22', rng: fixed });
  assert.equal(meals.length, 3);
  for (const m of meals) assert.doesNotMatch(textOf(m), /chicken|beef|pork|bacon|salmon|tuna|shrimp|peanut/i, m.name);
});

test('Feeling hungry only picks recipes of 20 minutes or less; Clean out uses the expiring food', () => {
  const fridge = rows(['egg', 6, 'piece'], ['spinach', 200, 'g', '2026-10-22'], ['mushroom', 10, 'piece', '2026-10-23'], ['bell pepper', 3, 'piece', '2026-10-24'],
    ['zucchini', 2, 'piece', '2026-10-25'], ['tofu', 400, 'g'], ['brown rice', 1000, 'g'], ['onion', 3, 'piece'], ['bread', 10, 'piece'], ['tomato', 4, 'piece']);
  const hungry = matchRecipes({ fridge, profile: { diet: 'Vegetarian' }, neededTypes: ['Breakfast', 'Lunch', 'Dinner'], mode: 'hungry', today: '2026-10-22', rng: fixed });
  for (const m of hungry.meals) assert.ok(parseInt(m.prepTime, 10) <= 20, `${m.name} ${m.prepTime}`);
  const clean = matchRecipes({ fridge, profile: { diet: 'Vegetarian' }, neededTypes: ['Breakfast', 'Lunch', 'Dinner'], mode: 'cleanOut', today: '2026-10-22', rng: fixed });
  const used = new Set(clean.meals.flatMap((m) => m.structuredIngredients.map((i) => i.name)).filter((n) => ['spinach', 'mushroom', 'bell pepper', 'zucchini'].includes(n)));
  assert.ok(used.size >= 3 || clean.unfilled.length > 0, `used ${[...used]}`);
});

test('Refresh with the current recipes excluded returns different ones', () => {
  const fridge = rows(['egg', 6, 'piece'], ['bread', 10, 'piece'], ['milk', 1000, 'ml'], ['banana', 4, 'piece'], ['chicken breast', 500, 'g'], ['white rice', 1000, 'g'], ['broccoli', 300, 'g']);
  const first = matchRecipes({ fridge, profile: {}, neededTypes: ['Lunch'], today: '2026-10-22', rng: fixed });
  const second = matchRecipes({ fridge, profile: {}, neededTypes: ['Lunch'], today: '2026-10-22', exclude: [first.meals[0].recipeId], rng: fixed });
  assert.notEqual(first.meals[0].recipeId, second.meals[0].recipeId);
});

test('a fully matched plan makes no model call; a fridge no recipe uses goes to the AI', async () => {
  const noModel = { runAgent: async () => assert.fail('no model call expected'), jsonCompletion: async () => assert.fail('no model call expected') };
  const fridge = rows(['egg', 6, 'piece'], ['bread', 10, 'piece'], ['chicken breast', 500, 'g'], ['white rice', 1000, 'g'], ['broccoli', 300, 'g'], ['pasta', 500, 'g'], ['tomato', 4, 'piece']);
  const out = await planMeals({ fridge, profile: {}, neededTypes: ['Breakfast', 'Lunch', 'Dinner'], useLibrary: true, rng: fixed }, noModel);
  assert.equal(out.source, 'library');
  assert.equal(out.meals.length, 3);
  assert.ok(out.meals.every((m) => m.recipeSource === 'library' && m.macroSource !== 'estimated'));

  let aiCalls = 0;
  const ai = { runAgent: async () => { aiCalls += 1; return { meals: [{ name: 'Dragonfruit bowl', type: 'Breakfast', ingredients: ['1 dragonfruit'], structuredIngredients: [{ name: 'dragonfruit', quantity: 1, unit: 'piece' }], recipe: 'Step 1: Cut.', calories: 300, protein: 5, carbs: 60, fat: 2, prepTime: '5 min', missingIngredients: [] }] }; }, jsonCompletion: async () => assert.fail() };
  const odd = await planMeals({ fridge: rows(['dragonfruit', 2, 'piece']), profile: {}, neededTypes: ['Breakfast'], useLibrary: true, rng: fixed }, ai);
  assert.equal(aiCalls, 1);
  assert.equal(odd.source, 'ai');
});
