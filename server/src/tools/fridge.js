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

// Quantities are compared within a unit family only: g with kg, ml with L, piece, cup, tbsp (handoff 6.2).
// Anything else, or a missing number, is "unverified" rather than assumed enough.
export function baseQuantity(quantity, unit) {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return null;
  const u = String(unit || '').trim().toLowerCase().replace(/s$/, '');
  if (u === 'kg') return { amount: q * 1000, unit: 'g' };
  if (u === 'l') return { amount: q * 1000, unit: 'ml' };
  return u ? { amount: q, unit: u } : null;
}

export function compareQuantity(ing, row) {
  const need = baseQuantity(ing.quantity, ing.unit);
  const have = baseQuantity(row.quantity, row.unit);
  if (!need || !have || need.unit !== have.unit) return { status: 'unverified' };
  return { status: have.amount >= need.amount ? 'enough' : 'short', need: need.amount, have: have.amount, unit: need.unit };
}

export const isStaple = (name) => {
  const q = norm(name);
  return STAPLES.some((s) => q === norm(s) || q.endsWith(' ' + norm(s)));
};

// Recompute which ingredients come from the fridge rather than trusting the model's claim.
// Lines that match the same fridge row are added up before the quantity check. `short` lists fridge items
// with less than the recipe needs (same unit family); `unverified` lists ones whose units can't be compared.
export function fridgeCoverage(fridge, structuredIngredients) {
  const used = [];
  const missing = [];
  const byRow = new Map();
  for (const ing of structuredIngredients || []) {
    const match = findFridgeMatch(fridge, ing.name);
    if (match) {
      used.push({ name: ing.name, fridgeItem: match.name });
      byRow.set(match, [...(byRow.get(match) || []), ing]);
    } else if (!isStaple(ing.name)) missing.push(`${ing.name}${ing.quantity ? ` (${ing.quantity} ${ing.unit || ''})`.trimEnd() : ''}`);
  }
  const short = [];
  const unverified = [];
  for (const [row, lines] of byRow) {
    const bases = lines.map((l) => baseQuantity(l.quantity, l.unit));
    const sameUnit = bases.every((b) => b && b.unit === bases[0].unit);
    const total = sameUnit ? { quantity: bases.reduce((sum, b) => sum + b.amount, 0), unit: bases[0].unit } : {};
    const c = compareQuantity(total, row);
    if (c.status === 'short') short.push(`${row.name} (need ${Math.round(c.need)} ${c.unit}, have ${Math.round(c.have)} ${c.unit})`);
    if (c.status === 'unverified') unverified.push(row.name);
  }
  const countable = used.length + missing.length;
  return { used, missing, short, unverified, utilization: countable ? used.length / countable : 0 };
}

// Expiry is free text on older rows: only a real YYYY-MM-DD date counts (handoff 6.2). `today` is YYYY-MM-DD.
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const utc = (m) => {
  const d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return new Date(d).getUTCDate() === +m[3] ? d : null;
};
export function daysToExpiry(expiry, today) {
  const m = ISO.exec(String(expiry || '').trim());
  const t = ISO.exec(String(today || ''));
  const d = m && utc(m);
  const t0 = t && utc(t);
  return d === null || t0 === null || !m || !t ? null : Math.round((d - t0) / 86400000);
}

// Compact, LLM-friendly view of the fridge. Names are user-entered, so they are data, not instructions.
export function summarizeFridge(fridge) {
  return fridge.slice(0, 60).map((f) => ({
    name: cleanText(f.name, 60),
    quantity: Number(f.quantity) || f.quantity,
    unit: f.unit || '',
    category: f.category || 'Other',
    expiry: f.expiry || null,
    // From the package label, so the planner can avoid the user's allergens (6.1.3).
    ...(f.allergens && String(f.allergens).trim() ? { allergens: String(f.allergens).split(',').map((a) => a.trim()).filter(Boolean) } : {}),
  }));
}
