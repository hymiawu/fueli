// Rescales a planned meal when "Cooking for" changes, without asking the planner again. Ingredient amounts are
// for all diners and scale; calories and macros are per person and stay the same.
import { findFridgeMatch } from './cooking.js';
import { toBaseQuantity } from './nutrition.js';

const round = (q) => (q >= 10 ? Math.round(q) : Math.round(q * 100) / 100);
const fmt = (q) => String(round(q));

// Scales the first amount in an ingredient line: "200g chicken", "chicken (200 g)", "1/2 cup oats", "1 1/2 cups".
export function scaleText(text, factor) {
  return String(text).replace(/(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|\d+(?:\.\d+)?/, (m, w, n1, d1, n2, d2) => {
    const v = w !== undefined ? Number(w) + Number(n1) / Number(d1) : n2 !== undefined ? Number(n2) / Number(d2) : Number(m);
    return fmt(v * factor);
  });
}

// Fridge items with less than the (rescaled) recipe needs, same unit family only, in the server's wording.
function shortList(structuredIngredients, fridgeRows) {
  const byRow = new Map();
  for (const ing of structuredIngredients) {
    const row = findFridgeMatch(fridgeRows, ing.name);
    if (row) byRow.set(row, [...(byRow.get(row) || []), ing]);
  }
  const short = [];
  for (const [row, lines] of byRow) {
    const need = lines.map((l) => toBaseQuantity(l.quantity, l.unit));
    const have = toBaseQuantity(row.quantity, row.unit);
    if (!have || need.some((n) => !n || n.unit !== have.unit)) continue;
    const total = need.reduce((s, n) => s + n.amount, 0);
    if (total > have.amount) short.push(`${row.name} (need ${Math.round(total)} ${have.unit}, have ${Math.round(have.amount)} ${have.unit})`);
  }
  return short;
}

export function scaleMeal(meal, newServings, fridgeRows = null) {
  const from = Number(meal.servings) || 1;
  if (!newServings || newServings === from || meal.cooked || meal.type === 'Outside') return meal;
  const factor = newServings / from;
  const structuredIngredients = (meal.structuredIngredients || []).map((i) => ({ ...i, quantity: round(Number(i.quantity) * factor) }));
  const missingIngredients = (meal.missingIngredients || []).map((t) => scaleText(t, factor));
  const shortIngredients = fridgeRows ? shortList(structuredIngredients, fridgeRows) : meal.shortIngredients;
  const toBuy = missingIngredients.length + (shortIngredients?.length || 0);
  return {
    ...meal,
    servings: newServings,
    structuredIngredients,
    ingredients: (meal.ingredients || []).map((t) => scaleText(t, factor)),
    missingIngredients,
    shortIngredients,
    ...(meal.modeEvidence?.toBuy !== undefined ? { modeEvidence: { ...meal.modeEvidence, toBuy } } : {}),
  };
}
