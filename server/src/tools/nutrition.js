// Retrieval over the local nutrition knowledge base (src/data/nutrition.json).
// Deterministic on purpose: the LLM proposes, this grounds the numbers.
import { readFileSync } from 'node:fs';

const db = JSON.parse(readFileSync(new URL('../data/nutrition.json', import.meta.url), 'utf8'));
export const NUTRITION_SOURCE = db.source;

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.replace(/ies$/, 'y').replace(/(oes|ses|xes)$/, (m) => m.slice(0, -2)).replace(/s$/, ''))
    .join(' ');

const index = db.foods.map((f) => ({ food: f, keys: [f.name, ...f.aliases].map(norm) }));

// Words that describe preparation rather than the food itself.
const STOP = new Set(['fresh', 'raw', 'cooked', 'chopped', 'diced', 'sliced', 'large', 'small', 'medium', 'organic', 'boneless', 'skinless', 'of', 'and', 'cup', 'g']);

export function lookupFood(name) {
  const q = norm(name);
  if (!q) return null;
  let best = null;
  for (const { food, keys } of index) {
    for (const k of keys) {
      let score = 0;
      if (k === q) score = 100;
      else if (q.includes(k)) score = 60 + k.length; // "grilled chicken breast" -> "chicken breast"
      else if (k.includes(q) && q.length >= 4) score = 40 + q.length;
      else {
        const qw = q.split(' ').filter((w) => w.length > 2 && !STOP.has(w));
        const kw = k.split(' ');
        const hits = qw.filter((w) => kw.includes(w)).length;
        if (hits && hits === kw.length) score = 30 + hits;
      }
      if (score > (best?.score ?? 0)) best = { score, food };
    }
  }
  return best ? best.food : null;
}

const ML_PER = { ml: 1, l: 1000, cup: 240, tbsp: 15, tsp: 5 };

// Convert a quantity to grams. Returns null when we can't do it honestly.
export function toGrams(quantity, unit, food) {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return null;
  const u = String(unit || '').toLowerCase().replace(/s$/, '');
  if (u === 'g') return q;
  if (u === 'kg') return q * 1000;
  if (ML_PER[u]) return q * ML_PER[u]; // assume ~1 g/ml; fine for most kitchen foods
  if (u === 'piece' || u === 'pc' || u === '' || u === 'clove' || u === 'slice') return food?.gramsPerPiece ? q * food.gramsPerPiece : null;
  return null;
}

// Compute macros for a list of {name, quantity, unit}. Reports how much of the meal was covered.
export function computeMacros(items) {
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const matched = [];
  const unmatched = [];
  for (const it of items || []) {
    const food = lookupFood(it.name);
    const grams = food ? toGrams(it.quantity, it.unit, food) : null;
    if (!food || grams == null) {
      unmatched.push(it.name);
      continue;
    }
    const f = grams / 100;
    for (const k of Object.keys(total)) total[k] += food.per100g[k] * f;
    matched.push({ name: it.name, matchedTo: food.name, grams: Math.round(grams) });
  }
  const n = (items || []).length;
  return {
    calories: Math.round(total.calories),
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fat: Math.round(total.fat),
    coverage: n ? matched.length / n : 0,
    matched,
    unmatched,
  };
}

// Tool form used by the planner agent.
export function lookupNutritionTool({ names }) {
  return (names || []).slice(0, 20).map((name) => {
    const food = lookupFood(name);
    return food
      ? { query: name, found: food.name, per100g: food.per100g, gramsPerPiece: food.gramsPerPiece ?? null }
      : { query: name, found: null };
  });
}
