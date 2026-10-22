// Workout library matcher, the same pattern as the recipe library (D-19). The workouts were written once
// (src/data/workouts.json) from the 57-exercise library; per request, plain code picks up to 3 that fit the
// user's level, the weekly plan and the type filter. No model call. Slots no workout fits are left to the AI coach.
import { readFileSync } from 'node:fs';
import { checkWorkout } from '../agents/safetyGuard.js';
import { levelCap, verifyExercises } from '../agents/exerciseVerifier.js';

const { workouts } = JSON.parse(readFileSync(new URL('../data/workouts.json', import.meta.url), 'utf8'));
export const WORKOUTS = workouts;

// Muscles each weekly-plan focus trains, in the library's muscle names (exercises.json).
const PUSH = ['chest', 'shoulders', 'triceps'];
const PULL = ['lats', 'middle back', 'biceps'];
const LOWER = ['quadriceps', 'hamstrings', 'glutes', 'calves'];
export const FOCUS_MUSCLES = { Push: PUSH, Pull: PULL, Lower: LOWER, Upper: [...PUSH, ...PULL], 'Full Body': [...PUSH, ...PULL, ...LOWER] };
const LIGHT = ['Flexibility', 'Cardio'];
const HEAVY = ['Strength', 'HIIT'];

// Code check (6.3.3): on a rest day only light types pass, and Strength or HIIT may not train
// yesterday's or tomorrow's muscles. Muscles come from the library, not the model. A filter the user picked wins.
export function fitsWeekPlan(workout, { todayFocus, yesterdayFocus, tomorrowFocus, filterType }) {
  if (LIGHT.includes(workout.type) || filterType) return true;
  if (todayFocus === 'Rest') return false;
  const blocked = [yesterdayFocus, tomorrowFocus].flatMap((f) => FOCUS_MUSCLES[f] || []);
  return !(workout.exercises || []).some((ex) => (ex.primaryMuscles || []).some((m) => blocked.includes(m)));
}

const DIFFICULTY_RANK = { Beginner: 0, Intermediate: 1, Advanced: 2 };
const muscles = (w) => (w.exercises || []).flatMap((ex) => ex.primaryMuscles || []);

// The library workout in the coach's Workout shape, with steps and photos attached by the Exercise Verifier.
function toWorkout(entry, profile) {
  const { id, focus, easy, ...w } = entry;
  const { workout, stats } = verifyExercises(checkWorkout(w, profile), profile);
  return { workout: { ...workout, libraryId: id, workoutSource: 'library' }, removed: stats.removed };
}

// Muscles of the most recent session, when it came from the library (the coach's "not the same muscles" rule).
function recentMuscles(recentWorkouts, profile) {
  const last = recentWorkouts?.[0];
  const entry = last && WORKOUTS.find((w) => w.name === last.name && w.type === last.type);
  return entry && HEAVY.includes(entry.type) ? muscles(toWorkout(entry, profile).workout) : [];
}

// Which type leads on a plan day, when the day's focus has more than one kind of workout.
const LEAD_TYPE = { Cardio: 'Cardio', Flexibility: 'Flexibility', Rest: 'Flexibility' };

// Picks up to `count` workouts. Returns { workouts, missing } where missing is how many the AI coach should add.
// The first workout matches today's focus; the others mix types. Without a match for today's focus, the AI does it all.
export function matchWorkouts({ profile, todayFocus, yesterdayFocus, tomorrowFocus, filterType = null, recentWorkouts = [], exclude = [], count = 3, rng = Math.random }) {
  const day = { todayFocus, yesterdayFocus, tomorrowFocus, filterType };
  const cap = levelCap(profile);
  const skip = new Set(exclude);
  const lastMuscles = recentMuscles(recentWorkouts, profile);
  const candidates = [];
  for (const entry of WORKOUTS) {
    if (skip.has(entry.id) || (filterType && entry.type !== filterType)) continue;
    if (entry.id === 'optional-recovery' && todayFocus !== 'Rest') continue; // the name only makes sense on a rest day
    if (DIFFICULTY_RANK[entry.difficulty] > cap) continue;
    // A rest day gets stretching or easy cardio only, unless the user picked a type.
    if (todayFocus === 'Rest' && !filterType && !(entry.type === 'Flexibility' || (entry.type === 'Cardio' && entry.easy))) continue;
    const { workout, removed } = toWorkout(entry, profile);
    if (removed || !fitsWeekPlan(workout, day)) continue;
    if (HEAVY.includes(workout.type) && muscles(workout).some((m) => lastMuscles.includes(m))) continue;
    candidates.push({ entry, workout, score: rng() });
  }

  const picked = [];
  const take = (c) => {
    picked.push(c);
    candidates.splice(candidates.indexOf(c), 1);
  };
  if (todayFocus && !filterType) {
    // Rest days open with "Optional recovery" (as the AI prompt asks); training days with a workout for the focus.
    const leads = candidates.filter((c) => (todayFocus === 'Rest' ? c.entry.id === 'optional-recovery' : c.entry.focus.includes(todayFocus)));
    const leadType = LEAD_TYPE[todayFocus] || 'Strength';
    // A Cardio day leads with real cardio, not an easy recovery session.
    const rank = (c) => 2 * (c.workout.type === leadType) - (todayFocus === 'Cardio' && Boolean(c.entry.easy));
    const lead = leads.sort((a, b) => rank(b) - rank(a) || b.score - a.score)[0]
      || (todayFocus === 'Rest' ? candidates.find((c) => c.workout.type === 'Flexibility') : null);
    if (!lead) return { workouts: [], missing: count };
    take(lead);
  }
  while (picked.length < count && candidates.length) {
    // Variety: a type not picked yet first, then a focus not picked yet.
    const fresh = (c) => 2 * !picked.some((p) => p.workout.type === c.workout.type) + !picked.some((p) => p.entry.focus.join() === c.entry.focus.join());
    take(candidates.reduce((best, c) => (fresh(c) + c.score > fresh(best) + best.score ? c : best)));
  }
  return { workouts: picked.map((c) => c.workout), missing: count - picked.length };
}
