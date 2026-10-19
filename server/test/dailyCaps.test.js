// Daily caps per user and family (handoff 6.5, D-49), with a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeDaily, refundDaily, dailyUsage } from '../src/rateLimit.js';

test('the third meal plan is refused at DAILY_MEALS=2, and the count resets at midnight UTC', () => {
  process.env.DAILY_MEALS = '2';
  const t = Date.parse('2026-10-22T23:00:00Z');
  assert.equal(takeDaily('u1', 'meals', t), null);
  assert.equal(takeDaily('u1', 'meals', t), null);
  assert.equal(takeDaily('u1', 'meals', t), 'Daily limit reached: 2 meal plans a day on the $4.99 plan. Resets at midnight UTC.');
  assert.equal(takeDaily('u2', 'meals', t), null, 'other users are counted separately');
  assert.equal(takeDaily('u1', 'scans', t), null, 'other families are counted separately');
  assert.equal(takeDaily('u1', 'meals', Date.parse('2026-10-23T00:00:01Z')), null);
  delete process.env.DAILY_MEALS;
});

test('defaults are 20, 10 and 50; a refund gives one unit back', () => {
  const t = Date.parse('2026-10-22T12:00:00Z');
  for (let i = 0; i < 10; i++) assert.equal(takeDaily('u3', 'workouts', t), null);
  assert.match(takeDaily('u3', 'workouts', t), /10 workout requests a day/);
  refundDaily('u3', 'workouts', t);
  assert.equal(takeDaily('u3', 'workouts', t), null);
  const u = dailyUsage('u3', t);
  assert.deepEqual(u.workouts, { used: 10, limit: 10 });
  assert.deepEqual(u.meals, { used: 0, limit: 20 });
  assert.deepEqual(u.scans, { used: 0, limit: 50 });
});
