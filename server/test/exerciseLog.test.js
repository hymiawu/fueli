// "Last time" wording and session history (lib/exerciseLog.js, handoff 6.3.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSession, lastTimeText, MAX_SESSIONS } from '../../lib/exerciseLog.js';

test('3 x 10 at 12 kg, and differing reps', () => {
  const log = addSession({}, 'Goblet_Squat', { date: '2026-10-20', sets: [1, 2, 3].map(() => ({ reps: 10, weightKg: 12 })) });
  assert.equal(lastTimeText(log.Goblet_Squat), 'Last time: 3 × 10 @ 12 kg');
  assert.equal(lastTimeText([{ sets: [{ reps: 10, weightKg: 12 }, { reps: 10, weightKg: 12 }, { reps: 8, weightKg: 12 }] }]), 'Last time: 10, 10, 8 @ 12 kg');
  assert.equal(lastTimeText([{ sets: [{ reps: 10, weightKg: 13.6 }] }], 'imperial'), 'Last time: 1 × 10 @ 30 lb');
});

test('keeps the last 5 sessions, one per day', () => {
  let log = {};
  for (let d = 1; d <= 7; d++) log = addSession(log, 'Pushups', { date: `2026-10-0${d}`, sets: [{ reps: d, weightKg: 0 }] });
  log = addSession(log, 'Pushups', { date: '2026-10-07', sets: [{ reps: 20, weightKg: 0 }] });
  assert.equal(log.Pushups.length, MAX_SESSIONS);
  assert.equal(log.Pushups[0].sets[0].reps, 20);
});
