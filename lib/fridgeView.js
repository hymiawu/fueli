// My Fridge ranking and filtering (handoff 6.1.2, D-15, D-32, D-33). Client-side on the loaded rows,
// which arrive newest first.
import { parseExpiry } from './expiry.js';

export const SORTS = [
  { key: 'newest', label: 'Newest', a11y: 'Newest added first' },
  { key: 'oldest', label: 'Oldest', a11y: 'Oldest added first' },
  { key: 'expSoon', label: 'Expiring soon', a11y: 'Expiring soonest first' },
  { key: 'expLate', label: 'Expiring late', a11y: 'Expiring latest first' },
];

export const ADDED = [
  { key: 'any', label: 'Any time', ms: null },
  { key: '24h', label: 'Last 24 hours', ms: 24 * 3600e3 },
  { key: '7d', label: 'Last 7 days', ms: 7 * 24 * 3600e3 },
  { key: '30d', label: 'Last 30 days', ms: 30 * 24 * 3600e3 },
];

export const DEFAULT_VIEW = { sort: 'newest', categories: [], added: 'any' };

const addedAt = (item) => new Date(item.created_at || 0).getTime();

// Number of active filters, for the "Filter 2" badge.
export const filterCount = (v) => (v.categories.length ? 1 : 0) + (v.added !== 'any' ? 1 : 0);

export function applyFridgeView(items, view = DEFAULT_VIEW, now = Date.now()) {
  const added = ADDED.find((a) => a.key === view.added);
  const cats = new Set(view.categories || []);
  const kept = items.filter((i) =>
    (!cats.size || cats.has(i.category || 'Other')) &&
    (!added?.ms || now - addedAt(i) <= added.ms));

  const byNewest = (a, b) => addedAt(b) - addedAt(a);
  if (view.sort === 'oldest') return [...kept].sort((a, b) => -byNewest(a, b));
  if (view.sort === 'expSoon' || view.sort === 'expLate') {
    const dir = view.sort === 'expSoon' ? 1 : -1;
    // Undated or unparseable expiry goes to the end in both directions; ties keep newest first.
    return [...kept].sort((a, b) => {
      const da = parseExpiry(a.expiry);
      const db = parseExpiry(b.expiry);
      if (da && db) return (da - db) * dir || byNewest(a, b);
      if (da) return -1;
      if (db) return 1;
      return byNewest(a, b);
    });
  }
  return [...kept].sort(byNewest);
}
