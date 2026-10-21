// The weekly plan's rules for today's workouts (Neil's Oct 20 fixes). No model calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestWorkouts, dayRuleProblem, dayRules } from '../src/agents/workoutCoach.js';

const w = (name, type, ...ids) => ({ name, type, duration: '30 min', caloriesBurned: 200, difficulty: 'Beginner', muscleGroups: [], description: '', exercises: ids.map((exerciseId) => ({ exerciseId, sets: 3, reps: 10 })) });
const recovery = w('Optional recovery', 'Flexibility', 'Hamstring_Stretch', 'Cat_Stretch');
const bench = w('Upper Body Strength', 'Strength', 'Dumbbell_Bench_Press', 'One-Arm_Dumbbell_Row');
const jumps = w('Lower Body HIIT Circuit', 'HIIT', 'Freehand_Jump_Squat', 'Mountain_Climbers');
const walk = w('Easy walk', 'Cardio', 'Walking_Treadmill');
const stretch2 = w('Evening stretch', 'Flexibility', 'Childs_Pose', 'Spinal_Stretch');
const profile = { goal: 'Maintain Weight', activity: 'Moderately Active' };

test('a rest day never returns Strength or HIIT, even when the model suggests them', async () => {
  let calls = 0;
  const deps = { jsonCompletion: async () => (++calls === 1 ? { workouts: [recovery, bench, jumps] } : { workouts: [jumps, walk, stretch2] }) };
  const out = await suggestWorkouts({ profile, recentWorkouts: [], filterType: null, todayFocus: 'Rest', yesterdayFocus: 'Upper', tomorrowFocus: 'Lower' }, deps);
  assert.equal(calls, 2, 'one retry for the dropped workouts');
  assert.ok(out.workouts.length >= 1);
  for (const x of out.workouts) assert.ok(['Flexibility', 'Cardio'].includes(x.type), x.name);
  assert.equal(out.workouts[0].name, 'Optional recovery');
});

test('a rest day with the Strength filter gets a clear message instead of workouts', async () => {
  const deps = { jsonCompletion: async () => assert.fail('no model call expected') };
  await assert.rejects(
    suggestWorkouts({ profile, recentWorkouts: [], filterType: 'Strength', todayFocus: 'Rest' }, deps),
    (e) => e.status === 400 && /rest day/.test(e.message),
  );
});

test('on a training day, workouts that hit the muscles planned for yesterday or tomorrow are dropped', () => {
  const rules = dayRules({ todayFocus: 'Lower', yesterdayFocus: 'Upper', tomorrowFocus: 'Rest' });
  const verified = (x) => ({ ...x, exercises: x.exercises.map((e) => ({ ...e, primaryMuscles: { Dumbbell_Bench_Press: ['chest'], 'One-Arm_Dumbbell_Row': ['middle back'], Goblet_Squat: ['quadriceps'] }[e.exerciseId] ?? [] })) });
  assert.match(dayRuleProblem(verified(bench), rules), /chest|back/);
  assert.equal(dayRuleProblem(verified(w('Legs', 'Strength', 'Goblet_Squat')), rules), null);
  // Without a plan there are no rules.
  assert.equal(dayRuleProblem(verified(bench), dayRules({})), null);
});

test('stretching and easy cardio are allowed next to any planned day', () => {
  const rules = dayRules({ todayFocus: 'Rest', yesterdayFocus: 'Upper', tomorrowFocus: 'Lower' });
  const stretch = { ...recovery, exercises: [{ exerciseId: 'Hamstring_Stretch', primaryMuscles: ['hamstrings'] }] };
  assert.equal(dayRuleProblem(stretch, rules), null);
});
