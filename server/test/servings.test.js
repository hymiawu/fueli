// Rescaling a planned meal when "Cooking for" changes (lib/servings.js). No model calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleMeal, scaleText } from '../../lib/servings.js';

const meal = {
  type: 'Dinner', servings: 2, cooked: false, calories: 520, protein: 40,
  ingredients: ['300 g chicken breast', 'white rice (200 g)', '1/2 cup peas', '2 piece tomato'],
  structuredIngredients: [{ name: 'chicken breast', quantity: 300, unit: 'g' }, { name: 'white rice', quantity: 200, unit: 'g' }, { name: 'peas', quantity: 0.5, unit: 'cup' }, { name: 'tomato', quantity: 2, unit: 'piece' }],
  missingIngredients: ['peas (0.5 cup)'],
  shortIngredients: ['chicken breast (need 300 g, have 200 g)'],
  modeEvidence: { toBuy: 2 },
};
const fridge = [{ name: 'chicken breast', quantity: '200', unit: 'g' }, { name: 'white rice', quantity: '1', unit: 'kg' }, { name: 'tomato', quantity: '3', unit: 'piece' }];

test('2 people to 1: amounts halve, calories per person stay', () => {
  const m = scaleMeal(meal, 1, fridge);
  assert.equal(m.servings, 1);
  assert.deepEqual(m.structuredIngredients.map((i) => i.quantity), [150, 100, 0.25, 1]);
  assert.deepEqual(m.ingredients, ['150 g chicken breast', 'white rice (100 g)', '0.25 cup peas', '1 piece tomato']);
  assert.deepEqual(m.missingIngredients, ['peas (0.25 cup)']);
  assert.deepEqual(m.shortIngredients, [], '150 g of chicken now fits the 200 g in the fridge');
  assert.equal(m.modeEvidence.toBuy, 1);
  assert.equal(m.calories, 520);
});

test('going up rechecks what is short', () => {
  const m = scaleMeal(meal, 4, fridge);
  assert.deepEqual(m.shortIngredients, ['chicken breast (need 600 g, have 200 g)', 'tomato (need 4 piece, have 3 piece)']);
});

test('cooked and outside meals are not touched; mixed fractions scale', () => {
  assert.equal(scaleMeal({ ...meal, cooked: true }, 1, fridge).servings, 2);
  assert.equal(scaleText('1 1/2 cups oats', 2), '3 cups oats');
});
