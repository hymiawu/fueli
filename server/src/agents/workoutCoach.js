import { jsonCompletion } from '../llm.js';
import { WorkoutPlan } from '../schemas.js';
import { asData, DATA_RULE, cleanText } from '../guard.js';
import { checkWorkout } from './safetyGuard.js';
import { allowedList, verifyExercises } from './exerciseVerifier.js';
import { coachProfile } from './weekPlanner.js';
import { MUSCLES } from '../plan/weekRules.js';

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

// The weekly plan's rules for today's workouts (6.3.3; Neil's Oct 20 fixes).
// Rest day: every workout is light recovery. Training day: the first workout matches today's focus, and none
// may train the muscles of yesterday's or tomorrow's planned focus.
const LIGHT_TYPES = ['Flexibility', 'Cardio'];
const LIB_TO_PLAN = { quadriceps: 'quads', lats: 'back', 'middle back': 'back', 'lower back': 'back' };
const planMuscle = (m) => LIB_TO_PLAN[String(m).toLowerCase()] ?? String(m).toLowerCase();

export function dayRules({ todayFocus, yesterdayFocus, tomorrowFocus }) {
  const avoid = [...new Set([yesterdayFocus, tomorrowFocus].flatMap((f) => MUSCLES[f] || []))];
  return { rest: todayFocus === 'Rest', todayFocus, avoid, neighbours: { yesterdayFocus, tomorrowFocus } };
}

function focusLine(rules) {
  if (!rules.todayFocus) return '';
  if (rules.rest) return 'Today is a rest day. All workouts must be light recovery: Flexibility or easy, low-intensity Cardio. No Strength or HIIT. Make the first one a Flexibility session called "Optional recovery".\n';
  const { yesterdayFocus, tomorrowFocus } = rules.neighbours;
  const around = [yesterdayFocus && `yesterday is ${yesterdayFocus}`, tomorrowFocus && `tomorrow is ${tomorrowFocus}`].filter(Boolean).join(' and ');
  return `Today's planned focus is ${rules.todayFocus}. Make the first workout match it.${rules.avoid.length ? ` In the weekly plan ${around}, so no workout may train ${rules.avoid.join(', ')}.` : ''}\n`;
}

// Why a verified workout breaks today's rules, or null. Uses the library's primary muscles, not the model's labels.
export function dayRuleProblem(workout, rules) {
  if (rules.rest && !LIGHT_TYPES.includes(workout.type)) return `${workout.type} on a rest day`;
  // Stretching and easy cardio don't count as training a muscle group; only Strength and HIIT do.
  if (LIGHT_TYPES.includes(workout.type)) return null;
  const hit = (workout.exercises || []).flatMap((e) => e.primaryMuscles || []).map(planMuscle).filter((m) => rules.avoid.includes(m));
  return hit.length ? `trains ${[...new Set(hit)].join(', ')}, planned for the day before or after` : null;
}

// `deps` lets tests replace the model call.
export async function suggestWorkouts({ profile, recentWorkouts, filterType, todayFocus, yesterdayFocus, tomorrowFocus, trace }, deps = { jsonCompletion }) {
  const p = coachProfile(profile);
  const rules = dayRules({ todayFocus, yesterdayFocus, tomorrowFocus });
  if (rules.rest && filterType && !LIGHT_TYPES.includes(filterType)) {
    throw Object.assign(new Error(`Today is a rest day in your weekly plan, so there are no ${filterType} workouts. Choose Flexibility, Cardio or All.`), { status: 400 });
  }
  const recent = recentWorkouts.slice(0, 7).map((w) => ({ date: w.date, name: cleanText(w.name, 60), type: w.type }));
  const typeRule = filterType ? `All must be type ${filterType}.` : rules.rest ? 'Use only Flexibility and easy Cardio.' : 'Mix types (Strength, Cardio, HIIT, Flexibility).';
  // The allowed list is short enough to send whole; a tool loop would add seconds to a 12-16 s call (6.3.4).
  const context = `${asData('profile', p)}
${asData('recent_workouts', recent.length ? recent : 'none')}
Allowed exercises (id | name | level | main muscle | equipment):
${allowedList(p)}`;
  const plan = await deps.jsonCompletion({
    system: SYSTEM,
    messages: [{ role: 'user', content: `Create 3 workouts. ${typeRule}\n${focusLine(rules)}${context}` }],
    schema: WorkoutPlan,
    trace,
  });
  const stats = { byId: 0, byName: 0, removed: 0 };
  const problems = [];
  // Verify against the library, then drop workouts that are empty or break today's plan rules.
  const verify = (list) => list
    .filter((w) => !filterType || w.type === filterType)
    .map((w) => {
      const r = verifyExercises(checkWorkout(w, p), p);
      for (const k of Object.keys(stats)) stats[k] += r.stats[k];
      return r.workout;
    })
    .filter((w) => {
      const problem = !w.exercises.length ? 'no verified exercises' : dayRuleProblem(w, rules);
      if (problem) problems.push(`"${w.name}": ${problem}`);
      return !problem;
    });
  let workouts = verify(plan.workouts);

  // Fewer than 3 left: one more try for the missing ones, with the reasons (6.3.4 retry, also used for plan rules).
  if (workouts.length < 3) {
    trace?.flags.push(problems.some((x) => !x.endsWith('no verified exercises')) ? 'plan_rule_retry' : 'exercise_retry');
    const missing = 3 - workouts.length;
    const retry = await deps.jsonCompletion({
      system: SYSTEM,
      messages: [{ role: 'user', content: `Create ${missing} workout(s). ${typeRule}\n${focusLine(rules)}These were rejected: ${problems.join('; ') || 'none'}. Use only exercises from the allowed list.\n${context}` }],
      schema: WorkoutPlan,
      trace,
    }).catch(() => ({ workouts: [] }));
    workouts = [...workouts, ...verify(retry.workouts)].slice(0, 3);
  }
  if (!workouts.length) throw Object.assign(new Error('Could not build workouts that fit your plan. Please try again.'), { status: 502 });
  return { workouts, exerciseCheck: stats };
}
