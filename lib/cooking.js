// Marking a meal Cooked takes its ingredients out of the fridge; undoing puts back exactly what was taken
// (handoff 6.2.1, D-42). Planning is pure so it can be tested; MealScreen applies the writes.
import { toBaseQuantity } from './nutrition.js';

const norm = (s) => String(s || '').toLowerCase().trim().replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '');

export function findFridgeMatch(fridgeItems, ingName) {
  const normIng = norm(ingName);
  const words = normIng.split(/\s+/).filter((w) => w.length > 2);
  return fridgeItems.find((item) => {
    const normF = norm(item.name);
    if (normF === normIng) return true;
    if (normF.includes(normIng) || normIng.includes(normF)) return true;
    return words.some((w) => normF.includes(w));
  });
}

const round = (n) => Math.round(n * 10) / 10;
// Base amount (g, ml, piece, ...) back to the fridge row's own unit, e.g. 1500 g -> 1.5 for a kg row.
const toRowUnit = (amount, rowUnit) => (/^(kg|l)$/i.test(String(rowUnit || '').trim()) ? amount / 1000 : amount);

// ingredients: [{ name, quantity, unit }] for the whole recipe. fridgeRows: the user's rows, fresh from Supabase.
// Returns the writes to make and the summary to show. Nothing is subtracted across unit families.
export function planCooked(ingredients, fridgeRows) {
  // Recipe lines that match the same fridge row are merged first, so a row is deducted once.
  const byRow = new Map();
  for (const ing of ingredients) {
    const row = findFridgeMatch(fridgeRows, ing.name);
    if (!row) continue; // not in the fridge: nothing to deduct
    byRow.set(row, [...(byRow.get(row) || []), ing]);
  }

  const ops = [];
  const summary = { deducted: [], depleted: [], unverified: [], outside: [] };
  for (const [row, lines] of byRow) {
    const have = toBaseQuantity(row.quantity, row.unit);
    const needs = lines.map((l) => toBaseQuantity(l.quantity, l.unit));
    if (!have || have.amount <= 0 || needs.some((n) => !n || n.unit !== have.unit)) {
      summary.unverified.push(`${row.name} (${lines.map((l) => `${l.quantity} ${l.unit || ''}`.trim()).join(' + ')} vs ${row.quantity} ${row.unit || ''})`.replace(/\s+\)/, ')'));
      continue;
    }
    const need = needs.reduce((s, n) => s + n.amount, 0);
    const taken = Math.min(need, have.amount);
    const left = have.amount - taken;
    const usedInRowUnit = round(toRowUnit(taken, row.unit));
    if (left <= 0) {
      ops.push({ type: 'delete', row, used: usedInRowUnit });
      summary.depleted.push(`${row.name}: used up (${usedInRowUnit} ${row.unit})`);
      if (need > have.amount) summary.outside.push(`${row.name}: ${round(need - have.amount)} ${have.unit} more than the fridge had`);
    } else {
      const newQty = round(toRowUnit(left, row.unit));
      ops.push({ type: 'update', row, used: usedInRowUnit, quantity: newQty });
      summary.deducted.push(`${row.name}: used ${usedInRowUnit} ${row.unit} → ${newQty} ${row.unit} left`);
    }
  }
  return { ops, summary };
}

// What to remember on the meal so undo restores exactly what was taken. Same fields as before, so plans
// saved by the previous version still undo.
export const deductionRecord = (op) => ({
  fridgeId: op.row.id,
  name: op.row.name,
  used: op.used,
  unit: op.row.unit || '',
  wasDeleted: op.type === 'delete',
  originalQty: Number(op.row.quantity),
  originalItem: { ...op.row },
});

export function summaryText({ deducted, depleted, unverified, outside }) {
  const parts = [];
  if (deducted.length) parts.push(`Deducted:\n${deducted.map((d) => `• ${d}`).join('\n')}`);
  if (depleted.length) parts.push(`Used up:\n${depleted.map((d) => `• ${d}`).join('\n')}`);
  if (outside.length) parts.push(`From outside the tracked fridge:\n${outside.map((d) => `• ${d}`).join('\n')}`);
  if (unverified.length) parts.push(`Not deducted, units don't match:\n${unverified.map((d) => `• ${d}`).join('\n')}`);
  return parts.join('\n\n') || 'No matching fridge ingredients found to deduct.';
}
