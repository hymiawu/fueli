import { jsonCompletion } from '../llm.js';
import { WorkoutPlan } from '../schemas.js';
import { asData, DATA_RULE, cleanText } from '../guard.js';
import { checkWorkout } from './safetyGuard.js';
import { allowedList, verifyExercises } from './exerciseVerifier.js';
import { coachProfile } from './weekPlanner.js';

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

// Today's line from the weekly plan (6.3.3).
const focusLine = (todayFocus) =>
  !todayFocus ? ''
  : todayFocus === 'Rest' ? 'Today is a rest day. Make the first workout a light Flexibility session called "Optional recovery".\n'
  : `Today's planned focus is ${todayFocus}. Make the first workout match it; the other two can vary.\n`;

// `deps` lets tests replace the model call.
export async function suggestWorkouts({ profile, recentWorkouts, filterType, todayFocus, trace }, deps = { jsonCompletion }) {
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
        content: `Create 3 workouts. ${filterType ? `All must be type ${filterType}.` : 'Mix types (Strength, Cardio, HIIT, Flexibility).'}
${focusLine(todayFocus)}${context}`,
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
  let workouts = verify(plan.workouts);

  // A workout left with no verified exercises gets one more try, then is dropped (6.3.4).
  const empty = workouts.filter((w) => !w.exercises.length);
  if (empty.length) {
    trace?.flags.push('exercise_retry');
    const retry = await deps.jsonCompletion({
      system: SYSTEM,
      messages: [{ role: 'user', content: `Create ${empty.length} workout(s) of type ${empty.map((w) => w.type).join(', ')}, using only exercises from the allowed list.\n${context}` }],
      schema: WorkoutPlan,
      trace,
    }).catch(() => ({ workouts: [] }));
    const fixed = verify(retry.workouts).filter((w) => w.exercises.length);
    workouts = workouts.map((w) => (w.exercises.length ? w : fixed.shift() ?? w)).filter((w) => w.exercises.length);
  }
  if (!workouts.length) throw Object.assign(new Error('Could not build workouts from the exercise library. Please try again.'), { status: 502 });
  return { workouts, exerciseCheck: stats };
}
