import { jsonCompletion } from '../llm.js';
import { WorkoutPlan } from '../schemas.js';
import { asData, DATA_RULE, cleanText } from '../guard.js';
import { checkWorkout } from './safetyGuard.js';
import { allowedList, verifyExercises } from './exerciseVerifier.js';
import { coachProfile } from './weekPlanner.js';
import { FOCUS_MUSCLES, fitsWeekPlan, matchWorkouts } from '../plan/workoutMatcher.js';

export { fitsWeekPlan };

const SYSTEM = `You are Fueli's workout coach. Create safe, goal-appropriate workouts.
${DATA_RULE}
- Do not train any muscle group the most recent session trained, in any of the workouts, including full-body ones. A push day trained chest, shoulders and triceps; a pull day trained back and biceps; a leg day trained quadriceps, hamstrings, glutes and calves.
- Match difficulty to the user's activity level; do not prescribe Advanced work for sedentary users.
- Include warm-up and cool-down. Give one concise form tip per strength exercise.
- Only use exercises from the allowed list. Put its id in "exerciseId". Do not invent exercises.
Exercise shapes by type:
Strength: {"exerciseId","name","sets","reps","rest","weight","tempo","formTip","notes"}
Cardio: {"exerciseId","name","duration","intensity","targetHR","structure","notes"}
HIIT: {"exerciseId","name","work","rest","rounds","notes"}
Flexibility: {"exerciseId","name","hold","sets","breathingCue","notes"}
Final JSON format:
{"workouts":[{"name":"","type":"Strength|Cardio|HIIT|Flexibility","duration":"45 min","caloriesBurned":300,"difficulty":"Beginner|Intermediate|Advanced","muscleGroups":[],"description":"why this fits the user","warmup":"","cooldown":"","exercises":[...]}]}`;

// Today's line from the weekly plan (6.3.3), with yesterday's and tomorrow's focus so no option repeats their muscles.
// `lead` is false when the library already gave the user the workout for today's focus.
const focusLine = (todayFocus, yesterdayFocus, tomorrowFocus, lead = true) => {
  if (!todayFocus) return '';
  if (todayFocus === 'Rest') {
    return `Today is a rest day. All workouts must be light recovery: Flexibility or easy, low-intensity Cardio. No Strength or HIIT.${lead ? ' Make the first workout a Flexibility session called "Optional recovery".' : ''}\n`;
  }
  const sides = [['yesterday', yesterdayFocus], ['tomorrow', tomorrowFocus]].filter(([, f]) => FOCUS_MUSCLES[f]);
  const blocked = [...new Set(sides.flatMap(([, f]) => FOCUS_MUSCLES[f]))];
  const why = sides.map(([when, f]) => `${when} is ${f}`).join(' and ');
  return `Today's planned focus is ${todayFocus}. ${lead ? 'Make the first workout match it; the others can vary.' : 'The user already has a workout for it; these can vary.'}${blocked.length ? ` No Strength or HIIT workout may train ${blocked.join(', ')} (${why}).` : ''}\n`;
};

// The workout library is used first unless WORKOUT_LIBRARY=off or the caller passes useLibrary: false.
const libraryOn = () => process.env.WORKOUT_LIBRARY !== 'off';

// `deps` lets tests replace the model call.
// Workouts come from the library when enough fit the day; only the missing ones go to the AI coach.
export async function suggestWorkouts(args, deps = { jsonCompletion }) {
  const { profile, recentWorkouts = [], filterType, todayFocus, yesterdayFocus, tomorrowFocus, exclude = [], useLibrary = libraryOn(), rng, trace } = args;
  if (!useLibrary) return { ...(await suggestWithAI(args, deps)), source: 'ai' };

  const lib = matchWorkouts({ profile: coachProfile(profile), todayFocus, yesterdayFocus, tomorrowFocus, filterType, recentWorkouts, exclude, rng });
  const libStats = { byId: lib.workouts.reduce((n, w) => n + w.exercises.length, 0), byName: 0, removed: 0 };
  if (!lib.missing) {
    trace?.flags.push('library');
    return { workouts: lib.workouts, exerciseCheck: libStats, source: 'library' };
  }
  trace?.flags.push(lib.workouts.length ? 'library_partial' : 'library_none');
  let ai;
  try {
    ai = await suggestWithAI({ ...args, count: lib.missing, avoid: lib.workouts.map((w) => w.name), lead: !lib.workouts.length }, deps);
  } catch (e) {
    // The library's picks still fit the day; show them rather than an error.
    if (lib.workouts.length) return { workouts: lib.workouts, exerciseCheck: libStats, source: 'library' };
    throw e;
  }
  const exerciseCheck = Object.fromEntries(Object.keys(libStats).map((k) => [k, libStats[k] + ai.exerciseCheck[k]]));
  return { workouts: [...lib.workouts, ...ai.workouts], exerciseCheck, source: lib.workouts.length ? 'library+ai' : 'ai' };
}

async function suggestWithAI({ profile, recentWorkouts, filterType, todayFocus, yesterdayFocus, tomorrowFocus, count = 3, avoid = [], lead = true, trace }, deps) {
  const p = coachProfile(profile);
  const recent = recentWorkouts.slice(0, 7).map((w) => ({ date: w.date, name: cleanText(w.name, 60), type: w.type }));
  // The allowed list is short enough to send whole; a tool loop would add seconds to a 12-16 s call (6.3.4).
  const context = `${asData('profile', p)}
${asData('recent_workouts', recent.length ? recent : 'none')}
Allowed exercises (id | name | level | main muscle | equipment):
${allowedList(p)}`;
  const plan = await deps.jsonCompletion({
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Create ${count} workout${count === 1 ? '' : 's'}. ${filterType ? `All must be type ${filterType}.` : 'Mix types (Strength, Cardio, HIIT, Flexibility).'}${avoid.length ? ` The user already has: ${avoid.join(', ')}; make different ones.` : ''}
${focusLine(todayFocus, yesterdayFocus, tomorrowFocus, lead)}${context}`,
      },
    ],
    schema: WorkoutPlan,
    trace,
  });
  const stats = { byId: 0, byName: 0, removed: 0 };
  const verify = (list) => list
    .filter((w) => !filterType || w.type === filterType)
    .map((w) => {
      const r = verifyExercises(checkWorkout(w, p), p);
      for (const k of Object.keys(stats)) stats[k] += r.stats[k];
      return r.workout;
    });
  const day = { todayFocus, yesterdayFocus, tomorrowFocus, filterType };
  let workouts = verify(plan.workouts);
  const offPlan = workouts.filter((w) => !fitsWeekPlan(w, day)).length;
  if (offPlan) trace?.flags.push('week_plan_drop');
  workouts = workouts.filter((w) => fitsWeekPlan(w, day));

  // A workout left with no verified exercises, or dropped for breaking the weekly plan, gets one more try (6.3.4).
  const empty = workouts.filter((w) => !w.exercises.length);
  if (empty.length || offPlan) {
    trace?.flags.push('exercise_retry');
    const types = [...empty.map((w) => w.type), ...Array(offPlan).fill(todayFocus === 'Rest' ? 'Flexibility or easy Cardio' : 'any type')];
    const retry = await deps.jsonCompletion({
      system: SYSTEM,
      messages: [{ role: 'user', content: `Create ${types.length} workout(s) of type ${types.join(', ')}, using only exercises from the allowed list.\n${focusLine(todayFocus, yesterdayFocus, tomorrowFocus, lead)}${context}` }],
      schema: WorkoutPlan,
      trace,
    }).catch(() => ({ workouts: [] }));
    const fixed = verify(retry.workouts).filter((w) => w.exercises.length && fitsWeekPlan(w, day));
    workouts = workouts.map((w) => (w.exercises.length ? w : fixed.shift() ?? w)).filter((w) => w.exercises.length);
    workouts.push(...fixed.slice(0, offPlan));
  }
  if (!workouts.length) throw Object.assign(new Error('Could not build workouts from the exercise library. Please try again.'), { status: 502 });
  return { workouts: workouts.slice(0, count).map((w) => ({ ...w, workoutSource: 'ai' })), exerciseCheck: stats };
}
