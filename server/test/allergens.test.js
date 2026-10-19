// Allergen rules in the Safety Guard (handoff 6.1.3, D-48).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMeal } from '../src/agents/safetyGuard.js';
import { IngredientScan } from '../src/schemas.js';

const meal = (name, ...ings) => ({
  name, calories: 500, protein: 30, carbs: 40, fat: 15, recipe: 'Step 1: cook.',
  ingredients: ings, structuredIngredients: ings.map((n) => ({ name: n, quantity: 100, unit: 'g' })),
});

test('a listed allergen is a hard violation', () => {
  const { violations } = checkMeal(meal('Shrimp fried rice', 'shrimp', 'rice'), { allergies: ['Shellfish'] });
  assert.deepEqual(violations, ['Contains shellfish: shrimp']);
  assert.deepEqual(checkMeal(meal('Shrimp fried rice', 'shrimp', 'rice'), { allergies: [] }).violations, []);
});

test('plant qualifiers: almond milk is tree nuts, not dairy; peanut butter is peanuts, not dairy', () => {
  const m = meal('Smoothie', 'almond milk', 'banana');
  assert.deepEqual(checkMeal(m, { allergies: ['Dairy'] }).violations, []);
  assert.deepEqual(checkMeal(m, { allergies: ['Tree nuts'] }).violations, ['Contains tree nuts: almond']);
  const pb = meal('Toast', 'peanut butter', 'banana');
  assert.deepEqual(checkMeal(pb, { allergies: ['Dairy'] }).violations, []);
  assert.deepEqual(checkMeal(pb, { allergies: ['Peanuts'] }).violations, ['Contains peanuts: peanut']);
});

test('eggplant is not egg; rice noodles are not gluten', () => {
  assert.deepEqual(checkMeal(meal('Eggplant stir fry', 'eggplant', 'rice noodle'), { allergies: ['Eggs', 'Gluten'] }).violations, []);
  assert.equal(checkMeal(meal('Pasta', 'pasta', 'tomato'), { allergies: ['Gluten'] }).violations.length, 1);
});

test('a fridge item whose label lists the allergen counts, even under a neutral name', () => {
  const fridge = [{ name: 'trail mix', allergens: 'Peanuts, Tree nuts' }];
  const { violations } = checkMeal(meal('Yogurt bowl', 'trail mix', 'oats'), { allergies: ['Peanuts'] }, fridge);
  assert.deepEqual(violations, ['Contains peanuts: trail mix']);
});

test('scan schema keeps only known allergens', () => {
  const r = IngredientScan.parse({ name: 'cookie', calories: 480, protein: 6, carbs: 60, fat: 24, allergens: ['gluten', 'Milk', 'Peanuts', 'Peanuts'] });
  assert.deepEqual(r.allergens, ['Gluten', 'Peanuts']);
  assert.deepEqual(IngredientScan.parse({ name: 'apple', calories: 52, protein: 0, carbs: 14, fat: 0, allergens: 'nope' }).allergens, []);
});
