// Exercise Verifier (handoff 6.3.4). No model calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyExercises, allowedExercises } from '../src/agents/exerciseVerifier.js';
import { suggestWorkouts } from '../src/agents/workoutCoach.js';

const workout = (exercises, type = 'Strength') => ({ name: 'W', type, duration: '30 min', caloriesBurned: 200, difficulty: 'Beginner', muscleGroups: [], description: '', exercises });

test('known ids get library steps and photos; a made-up exercise is dropped with a warning', () => {
  const { workout: w, stats } = verifyExercises(workout([
    { exerciseId: 'Goblet_Squat', name: 'goblet squats', sets: 3, reps: 10 },
    { name: 'Dumbbell Bicep Curl', sets: 3, reps: 12 }, // no id: matched by name
    { exerciseId: 'Made_Up_Curl', name: 'Made-Up Curl', sets: 3, reps: 10 },
  ]), { activity: 'Moderately Active' });
  assert.deepEqual(w.exercises.map((e) => e.exerciseId), ['Goblet_Squat', 'Dumbbell_Bicep_Curl']);
  assert.ok(w.exercises[0].instructions.length > 0 && w.exercises[0].images.length === 2);
  assert.equal(w.exercises[0].sets, 3, 'the plan numbers stay');
  assert.deepEqual(w.warnings, ['Removed an exercise we could not verify']);
  assert.deepEqual(stats, { byId: 1, byName: 1, removed: 1 });
  assert.equal(w.exerciseSource, 'verified');
});

test('a sedentary user only gets beginner exercises, in the prompt list and after the verifier', () => {
  assert.ok(allowedExercises({ activity: 'Sedentary' }).every((e) => e.level === 'beginner'));
  assert.equal(allowedExercises({ activity: 'Sedentary' }).length, 43);
  const { workout: w } = verifyExercises(workout([{ exerciseId: 'Clean_and_Jerk' }, { exerciseId: 'Pushups' }]), { activity: 'Sedentary' });
  assert.deepEqual(w.exercises.map((e) => e.exerciseId), ['Pushups']);
});

test('a workout left empty is asked for once more, then dropped', async () => {
  let calls = 0;
  const deps = {
    jsonCompletion: async () => (++calls === 1
      ? { workouts: [workout([{ exerciseId: 'Pushups', sets: 3, reps: 10 }]), workout([{ name: 'Invented Move' }], 'Cardio')] }
      : { workouts: [workout([{ exerciseId: 'Jogging_Treadmill', duration: '20 min' }], 'Cardio')] }),
  };
  const out = await suggestWorkouts({ profile: { activity: 'Moderately Active' }, recentWorkouts: [], filterType: null }, deps);
  assert.equal(calls, 2);
  assert.deepEqual(out.workouts.map((w) => w.exercises[0].exerciseId), ['Pushups', 'Jogging_Treadmill']);
});
