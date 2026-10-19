// Weekly plan rules (handoff 6.3.3) and eval case W4-week-rules (6.3.6). No model calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWeekPlan, fallbackPlan, DAYS } from '../src/plan/weekRules.js';
import { planWeek } from '../src/agents/weekPlanner.js';

const week = (focus) => ({ summary: '', days: DAYS.map((day) => ({ day, focus: focus[day] || 'Rest', note: '' })) });
const GOALS = ['Lose Fat', 'Build Muscle', 'Maintain Weight', 'Eat Healthier'];
const ACTIVITY = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'];

test('W4: back-to-back Push days are flagged (problem 3)', () => {
  const problems = checkWeekPlan(week({ Mon: 'Push', Tue: 'Push', Thu: 'Lower' }), { goal: 'Build Muscle', activity: 'Very Active' }, 3);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Mon \(Push\) and Tue \(Push\) both train chest/);
});

test('W4: a week with only one Rest day is flagged; Sun to Mon counts as back to back', () => {
  const six = week({ Mon: 'Upper', Tue: 'Lower', Wed: 'Cardio', Thu: 'Upper', Fri: 'Lower', Sat: 'Cardio' });
  assert.ok(checkWeekPlan(six, { activity: 'Very Active' }, 6).some((p) => /at least 2 Rest/.test(p)));
  const wrap = week({ Mon: 'Lower', Wed: 'Upper', Sun: 'Full Body' });
  assert.ok(checkWeekPlan(wrap, { activity: 'Very Active' }, 3).some((p) => /Sun \(Full Body\) and Mon \(Lower\)/.test(p)));
});

test('W4: every fallback row passes (4 goals x 4 activity levels x 4 day counts)', () => {
  for (const goal of GOALS) for (const activity of ACTIVITY) for (const n of [2, 3, 4, 5]) {
    const profile = { goal, activity };
    assert.deepEqual(checkWeekPlan(fallbackPlan(profile, n), profile, n), [], `${goal} / ${activity} / ${n} days`);
  }
});

test('Lose Fat without Cardio, and splits for a sedentary user, are flagged', () => {
  const p = checkWeekPlan(week({ Mon: 'Upper', Wed: 'Lower', Fri: 'Upper' }), { goal: 'Lose Fat', activity: 'Sedentary' }, 3);
  assert.ok(p.some((x) => /Cardio/.test(x)));
  assert.ok(p.some((x) => /Full Body instead of Upper, Lower/.test(x)));
});

test('one repair, then the fallback, marked by planSource', async () => {
  const bad = week({ Mon: 'Push', Tue: 'Push', Thu: 'Lower' });
  const good = week({ Mon: 'Full Body', Wed: 'Cardio', Fri: 'Full Body' });
  const profile = { goal: 'Lose Fat', activity: 'Moderately Active' };
  let calls = 0;
  const repaired = await planWeek({ profile, daysPerWeek: 3 }, { jsonCompletion: async () => (++calls === 1 ? bad : good) });
  assert.equal(repaired.planSource, 'ai-repaired');
  assert.equal(calls, 2);
  const fallback = await planWeek({ profile, daysPerWeek: 3 }, { jsonCompletion: async () => bad });
  assert.equal(fallback.planSource, 'fallback');
  assert.deepEqual(checkWeekPlan(fallback, profile, 3), []);
});
