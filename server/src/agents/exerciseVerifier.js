// Exercise Verifier (handoff 6.3.4): every exercise must come from the static library
// (src/data/exercises.json, Neil's PR #18). Steps, muscles and photos are attached from the library, never
// taken from the model. Runs after checkWorkout.
import { readFileSync } from 'node:fs';
import { MAX_DIFFICULTY } from './safetyGuard.js';

const { exercises } = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8'));
export const LIBRARY = exercises;
const byId = new Map(exercises.map((e) => [e.id, e]));
const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e]));

// Library levels against the guard's difficulty cap: beginner = Beginner, intermediate = Intermediate, expert = Advanced.
const LEVEL_RANK = { beginner: 0, intermediate: 1, expert: 2 };
const CAP_RANK = { Beginner: 0, Intermediate: 1, Advanced: 2 };
export function levelCap(profile) {
  const cap = MAX_DIFFICULTY[String(profile?.activity || '').toLowerCase()];
  return cap ? CAP_RANK[cap] : 2;
}
export const allowedExercises = (profile) => exercises.filter((e) => LEVEL_RANK[e.level] <= levelCap(profile));

// Compact lines for the prompt: "id | name | level | main muscle | equipment".
export const allowedList = (profile) =>
  allowedExercises(profile).map((e) => `${e.id} | ${e.name} | ${e.level} | ${e.primaryMuscles[0]} | ${e.equipment || 'none'}`).join('\n');

const find = (ex) => byId.get(String(ex.exerciseId || '')) || byName.get(String(ex.name || '').trim().toLowerCase()) || null;

// Returns the workout with library data attached, plus counts for the eval's process score.
export function verifyExercises(workout, profile) {
  const cap = levelCap(profile);
  const stats = { byId: 0, byName: 0, removed: 0 };
  const warnings = [...(workout.warnings || [])];
  const kept = [];
  for (const ex of workout.exercises || []) {
    const lib = find(ex);
    if (!lib) {
      stats.removed += 1;
      continue;
    }
    if (LEVEL_RANK[lib.level] > cap) {
      stats.removed += 1;
      continue;
    }
    if (byId.has(String(ex.exerciseId || ''))) stats.byId += 1;
    else stats.byName += 1;
    kept.push({
      ...ex,
      exerciseId: lib.id,
      name: lib.name,
      level: lib.level,
      equipment: lib.equipment,
      primaryMuscles: lib.primaryMuscles,
      secondaryMuscles: lib.secondaryMuscles,
      instructions: lib.instructions,
      images: lib.images,
    });
  }
  if (stats.removed) warnings.push('Removed an exercise we could not verify');
  return { workout: { ...workout, exercises: kept, warnings, exerciseSource: 'verified' }, stats };
}
