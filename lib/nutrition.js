// Nutrition views for a fridge item (handoff 6.1.1, D-14, D-39). The stored base is always per 100 g,
// unrounded; per serving and per whole package are derived from serving size and servings per package.
// Liquids: 1 ml counts as 1 g (D-45).

export const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'];
export const VIEWS = [
  { key: 'per100', label: 'Per 100 g' },
  { key: 'serving', label: 'Per serving' },
  { key: 'package', label: 'Whole package' },
];

export const toNum = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};

// Multiplier from per-100 g values to the given view, or null when the view needs a number we don't have.
export function viewFactor(view, servingSize, servingsPerPackage) {
  if (view === 'per100') return 1;
  const s = toNum(servingSize);
  if (!s || s <= 0) return null;
  if (view === 'serving') return s / 100;
  const n = toNum(servingsPerPackage);
  if (!n || n <= 0) return null;
  return (s * n) / 100;
}

// Rounded for display only: whole kcal, grams to one decimal.
export function formatNutrient(key, value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return key === 'calories' ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

// Per-100 g base (strings or numbers) -> display strings for a view.
export function toView(base, view, servingSize, servingsPerPackage) {
  const f = viewFactor(view, servingSize, servingsPerPackage);
  const out = {};
  for (const k of NUTRIENTS) {
    const b = toNum(base?.[k]);
    out[k] = f === null || b === null ? '' : formatNutrient(k, b * f);
  }
  return out;
}

// A value typed in a view -> the unrounded per-100 g base it implies (null if it can't be converted).
export function fromView(value, view, servingSize, servingsPerPackage) {
  const v = toNum(value);
  const f = viewFactor(view, servingSize, servingsPerPackage);
  if (v === null || !f) return null;
  return v / f;
}

// kcal in one serving, for the fridge card line "· 700 kcal per serving".
export function caloriesPerServing(item) {
  const f = viewFactor('serving', item?.serving_size);
  const c = toNum(item?.calories);
  return f === null || c === null ? null : Math.round(c * f);
}

// Quantity in the base unit of its family, so 1 kg compares with 1000 g and 1 L with 1000 ml.
export function toBaseQuantity(quantity, unit) {
  const q = toNum(quantity);
  if (q === null) return null;
  const u = String(unit || '').trim().toLowerCase().replace(/s$/, '');
  if (u === 'kg') return { amount: q * 1000, unit: 'g' };
  if (u === 'l') return { amount: q * 1000, unit: 'ml' };
  if (u === 'pc') return { amount: q, unit: 'piece' };
  return u ? { amount: q, unit: u } : null;
}
