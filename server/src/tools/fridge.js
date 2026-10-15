import { norm } from './nutrition.js';
import { cleanText } from '../guard.js';

// Ingredients pantry staples we never list as "missing".
const STAPLES = ['salt', 'pepper', 'black pepper', 'water', 'oil', 'olive oil', 'cooking spray', 'spice', 'herb'];

export function findFridgeMatch(fridge, ingName) {
  const q = norm(ingName);
  if (!q) return null;
  const words = q.split(' ').filter((w) => w.length > 2);
  return (
    fridge.find((f) => norm(f.name) === q) ||
    fridge.find((f) => { const n = norm(f.name); return n.includes(q) || q.includes(n); }) ||
    fridge.find((f) => { const n = norm(f.name); return words.some((w) => n.split(' ').includes(w)); }) ||
    null
  );
}

const isStaple = (name) => {
  const q = norm(name);
  return STAPLES.some((s) => q === norm(s) || q.endsWith(' ' + norm(s)));
};

// Recompute which ingredients come from the fridge rather than trusting the model's claim.
export function fridgeCoverage(fridge, structuredIngredients) {
  const used = [];
  const missing = [];
  for (const ing of structuredIngredients || []) {
    const match = findFridgeMatch(fridge, ing.name);
    if (match) used.push({ name: ing.name, fridgeItem: match.name });
    else if (!isStaple(ing.name)) missing.push(`${ing.name}${ing.quantity ? ` (${ing.quantity} ${ing.unit || ''})`.trimEnd() : ''}`);
  }
  const countable = used.length + missing.length;
  return { used, missing, utilization: countable ? used.length / countable : 0 };
}

// Compact, LLM-friendly view of the fridge. Names are user-entered, so they are data, not instructions.
export function summarizeFridge(fridge) {
  return fridge.slice(0, 60).map((f) => ({
    name: cleanText(f.name, 60),
    quantity: Number(f.quantity) || f.quantity,
    unit: f.unit || '',
    category: f.category || 'Other',
    expiry: f.expiry || null,
  }));
}
