import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMeals } from '../src/agents/mealPlanner.js';
import { newTrace } from '../src/llm.js';

// The model is mocked, so these tests make no API calls. They check what the code around it does
// when a draft breaks the user's diet.
const meal = (name, ingredient) => ({
  name,
  type: 'Dinner',
  ingredients: [`200g ${ingredient}`],
  structuredIngredients: [{ name: ingredient, quantity: 200, unit: 'g' }],
  recipe: 'Step 1: Cook it.',
  calories: 300,
  protein: 30,
  carbs: 10,
  fat: 10,
  prepTime: '20 min',
  missingIngredients: [],
});

const fridge = [{ name: 'tofu', quantity: '400', unit: 'g' }, { name: 'chicken breast', quantity: '500', unit: 'g' }];
const vegetarian = { diet: 'Vegetarian', goal: 'Eat Healthier' };

test('a meal that breaks a vegetarian diet is repaired once and the fix is kept', async () => {
  const calls = { repair: 0 };
  const deps = {
    runAgent: async () => ({ meals: [meal('Grilled chicken plate', 'chicken breast')] }),
    jsonCompletion: async () => {
      calls.repair += 1;
      return { meals: [meal('Crispy tofu plate', 'tofu')] };
    },
  };
  const trace = newTrace('meals');
  const out = await planMeals({ fridge, profile: vegetarian, neededTypes: ['Dinner'], useLibrary: false, trace }, deps);
  assert.equal(calls.repair, 1);
  assert.equal(out.meals.length, 1);
  assert.equal(out.meals[0].name, 'Crispy tofu plate');
  assert.deepEqual(out.blocked, []);
  assert.ok(trace.flags.includes('diet_repair'));
});

test('if the repair still breaks the diet, the meal is held back with the reason', async () => {
  const deps = {
    runAgent: async () => ({ meals: [meal('Grilled chicken plate', 'chicken breast')] }),
    jsonCompletion: async () => ({ meals: [meal('Chicken stir fry', 'chicken breast')] }),
  };
  const trace = newTrace('meals');
  const out = await planMeals({ fridge, profile: vegetarian, neededTypes: ['Dinner'], useLibrary: false, trace }, deps);
  assert.equal(out.meals.length, 0);
  assert.equal(out.blocked.length, 1);
  assert.equal(out.blocked[0].type, 'Dinner');
  assert.match(out.blocked[0].reason, /Not vegetarian/i);
  assert.ok(trace.flags.includes('blocked'));
});
