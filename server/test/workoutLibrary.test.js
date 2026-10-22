// Workout library and matcher (same pattern as the recipe library, D-19). No model calls unless faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORKOUTS, matchWorkouts, fitsWeekPlan } from '../src/plan/workoutMatcher.js';
import { LIBRARY } from '../src/agents/exerciseVerifier.js';
import { suggestWorkouts } from '../src/agents/workoutCoach.js';
import { Workout } from '../src/schemas.js';

const fixed = () => 0.5; // no random variety in tests
const sedentary = { activity: 'Sedentary', goal: 'Lose Fat' };
const moderate = { activity: 'Moderately Active' };
const noModel = { jsonCompletion: async () => assert.fail('the model should not be called') };
const ids = new Set(LIBRARY.map((e) => e.id));

test('every library workout is valid, uses only library exercises, and ids are unique', () => {
  assert.equal(new Set(WORKOUTS.map((w) => w.id)).size, WORKOUTS.length);
  for (const w of WORKOUTS) {
    assert.ok(Workout.safeParse(w).success, w.id);
    for (const ex of w.exercises) assert.ok(ids.has(ex.exerciseId), `${w.id}: ${ex.exerciseId}`);
  }
});

test('each plan focus has a beginner workout to lead with, and rest days have light ones', () => {
  for (const focus of ['Full Body', 'Upper', 'Push', 'Pull', 'Lower', 'Cardio', 'Flexibility']) {
    const out = matchWorkouts({ profile: sedentary, todayFocus: focus, rng: fixed });
    assert.equal(out.workouts.length, 3, focus);
    assert.equal(out.missing, 0, focus);
    assert.ok(out.workouts.every((w) => w.difficulty === 'Beginner' && w.exercises.every((e) => e.level === 'beginner')), focus);
    assert.ok(WORKOUTS.find((w) => w.id === out.workouts[0].libraryId).focus.includes(focus), `${focus} leads`);
  }
});

test('a rest day opens with Optional recovery and only gets stretching or easy cardio', () => {
  const out = matchWorkouts({ profile: moderate, todayFocus: 'Rest', yesterdayFocus: 'Upper', tomorrowFocus: 'Lower', rng: fixed });
  assert.equal(out.workouts[0].name, 'Optional recovery');
  for (const w of out.workouts) {
    const entry = WORKOUTS.find((x) => x.id === w.libraryId);
    assert.ok(w.type === 'Flexibility' || (w.type === 'Cardio' && entry.easy), w.name);
  }
});

test('on a training day, no Strength or HIIT pick trains yesterday\'s or tomorrow\'s muscles', () => {
  const day = { todayFocus: 'Cardio', yesterdayFocus: 'Rest', tomorrowFocus: 'Full Body' };
  for (let seed = 0; seed < 20; seed++) {
    const out = matchWorkouts({ profile: moderate, ...day, rng: () => (seed * 0.37) % 1 });
    assert.equal(out.workouts[0].type, 'Cardio');
    assert.ok(out.workouts.every((w) => fitsWeekPlan(w, day)));
  }
});

test('the type filter, the user level and the last session\'s muscles are respected', () => {
  const hiit = matchWorkouts({ profile: moderate, todayFocus: 'Rest', filterType: 'HIIT', rng: fixed });
  assert.ok(hiit.workouts.length && hiit.workouts.every((w) => w.type === 'HIIT'));
  const after = matchWorkouts({ profile: moderate, filterType: 'Strength', recentWorkouts: [{ date: '2026-10-20', name: 'Lower Body Dumbbell Day', type: 'Strength' }], rng: fixed });
  assert.ok(after.workouts.every((w) => !w.exercises.some((e) => ['quadriceps', 'glutes', 'calves'].includes(e.primaryMuscles[0]))));
});

test('asking again excludes what is on screen; when the library runs out, the rest is left to the AI', () => {
  const first = matchWorkouts({ profile: sedentary, todayFocus: 'Full Body', rng: fixed });
  const again = matchWorkouts({ profile: sedentary, todayFocus: 'Full Body', exclude: first.workouts.map((w) => w.libraryId), rng: fixed });
  assert.ok(again.workouts.every((w) => !first.workouts.some((f) => f.libraryId === w.libraryId)));
  const all = WORKOUTS.filter((w) => w.focus.includes('Push')).map((w) => w.id);
  assert.deepEqual(matchWorkouts({ profile: moderate, todayFocus: 'Push', exclude: all, rng: fixed }), { workouts: [], missing: 3 });
});

test('the coach answers from the library without calling the model', async () => {
  const out = await suggestWorkouts({ profile: sedentary, recentWorkouts: [], filterType: null, todayFocus: 'Full Body', yesterdayFocus: 'Rest', tomorrowFocus: 'Rest', rng: fixed }, noModel);
  assert.equal(out.source, 'library');
  assert.equal(out.workouts.length, 3);
  assert.ok(out.workouts.every((w) => w.workoutSource === 'library' && w.exerciseSource === 'verified'));
  assert.ok(out.workouts[0].exercises[0].instructions.length > 0, 'steps and photos attached');
});

test('slots the library cannot fill go to the AI, which is told what the user already has', async () => {
  const prompts = [];
  const bench = { name: 'AI Push', type: 'Strength', duration: '30 min', caloriesBurned: 200, difficulty: 'Beginner', muscleGroups: [], description: '', exercises: [{ exerciseId: 'Dumbbell_Bench_Press', sets: 3, reps: 10 }] };
  const deps = { jsonCompletion: async ({ messages }) => { prompts.push(messages.at(-1).content); return { workouts: [bench, bench, bench] }; } };
  const push = WORKOUTS.filter((w) => w.focus.includes('Push')).map((w) => w.id);
  const out = await suggestWorkouts({ profile: moderate, recentWorkouts: [], filterType: null, todayFocus: 'Push', exclude: push, rng: fixed }, deps);
  assert.equal(out.source, 'ai');
  assert.equal(out.workouts.length, 3);
  assert.ok(out.workouts.every((w) => w.workoutSource === 'ai'));
  assert.match(prompts[0], /Create 3 workouts/);

  const one = await suggestWorkouts({ profile: moderate, recentWorkouts: [], filterType: 'Flexibility', todayFocus: 'Rest', exclude: WORKOUTS.filter((w) => w.type === 'Flexibility').map((w) => w.id).slice(1), rng: fixed },
    { jsonCompletion: async ({ messages }) => { prompts.push(messages.at(-1).content); return { workouts: [{ ...bench, type: 'Flexibility', exercises: [{ exerciseId: 'Childs_Pose', hold: '30 sec' }] }] }; } });
  assert.equal(one.source, 'library+ai');
  assert.deepEqual(one.workouts.map((w) => w.workoutSource), ['library', 'ai']);
  assert.match(prompts.at(-1), /Create 2 workouts.*already has/);
});
