// My Fridge sort, filter and expiry wording (lib/fridgeView.js, lib/expiry.js, handoff 6.1.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFridgeView } from '../../lib/fridgeView.js';
import { expiryLabel, daysUntil, isValidExpiry } from '../../lib/expiry.js';

const now = new Date(2026, 9, 19, 12).getTime();
const at = (h) => new Date(now - h * 3600e3).toISOString();
const items = [
  { id: 'a', name: 'milk', category: 'Dairy', created_at: at(1), expiry: '' },
  { id: 'b', name: 'yogurt', category: 'Dairy', created_at: at(2), expiry: '2026-10-25' },
  { id: 'c', name: 'rice', category: 'Grains', created_at: at(30), expiry: 'soon-ish' },
  { id: 'd', name: 'spinach', category: 'Produce', created_at: at(50), expiry: '2026-10-21' },
  { id: 'e', name: 'egg', category: 'Protein', created_at: at(100), expiry: '' },
  { id: 'f', name: 'tofu', category: 'Protein', created_at: at(900), expiry: '' },
];
const ids = (list) => list.map((i) => i.id).join('');

test('expiring soonest: dated items first, the rest stay newest first', () => {
  assert.equal(ids(applyFridgeView(items, { sort: 'expSoon', categories: [], added: 'any' }, now)), 'dbacef');
  assert.equal(ids(applyFridgeView(items, { sort: 'expLate', categories: [], added: 'any' }, now)), 'bdacef');
});

test('newest and oldest by date added', () => {
  assert.equal(ids(applyFridgeView(items, { sort: 'newest', categories: [], added: 'any' }, now)), 'abcdef');
  assert.equal(ids(applyFridgeView(items, { sort: 'oldest', categories: [], added: 'any' }, now)), 'fedcba');
});

test('filters by category and by date added', () => {
  assert.equal(ids(applyFridgeView(items, { sort: 'newest', categories: ['Dairy'], added: 'any' }, now)), 'ab');
  assert.equal(ids(applyFridgeView(items, { sort: 'newest', categories: [], added: '24h' }, now)), 'ab');
  assert.equal(ids(applyFridgeView(items, { sort: 'newest', categories: ['Protein'], added: '7d' }, now)), 'e');
});

test('expiry wording and validation', () => {
  const today = new Date(now);
  assert.equal(daysUntil('2026-10-22', today), 3);
  assert.deepEqual(expiryLabel('2026-10-22', today), { text: 'Expires in 3 days', tone: 'soon' });
  assert.deepEqual(expiryLabel('2026-10-20', today), { text: 'Expires in 1 day', tone: 'soon' });
  assert.deepEqual(expiryLabel('2026-10-17', today), { text: 'Expired 2 days ago', tone: 'expired' });
  assert.equal(expiryLabel('', today), null);
  assert.equal(isValidExpiry('2026-02-30'), false);
  assert.equal(isValidExpiry(''), true);
});
