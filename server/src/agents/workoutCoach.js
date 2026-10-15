import { jsonCompletion } from '../llm.js';
import { WorkoutPlan } from '../schemas.js';
import { asData, DATA_RULE, cleanText } from '../guard.js';
import { checkWorkout } from './safetyGuard.js';

const SYSTEM = `You are Fueli's workout coach. Create safe, goal-appropriate workouts.
${DATA_RULE}
- Avoid training the same muscle groups as the most recent sessions.
- Match difficulty to the user's activity level; do not prescribe Advanced work for sedentary users.
- Include warm-up and cool-down. Give one concise form tip per strength exercise.
Exercise shapes by type:
Strength: {"name","sets","reps","rest","weight","tempo","formTip","notes"}
Cardio: {"name","duration","intensity","targetHR","structure","notes"}
HIIT: {"name","work","rest","rounds","notes"}
Flexibility: {"name","hold","sets","breathingCue","notes"}
Final JSON format:
{"workouts":[{"name":"","type":"Strength|Cardio|HIIT|Flexibility","duration":"45 min","caloriesBurned":300,"difficulty":"Beginner|Intermediate|Advanced","muscleGroups":[],"description":"why this fits the user","warmup":"","cooldown":"","exercises":[...]}]}`;

export async function suggestWorkouts({ profile, recentWorkouts, filterType, trace }) {
  const p = {
    goal: cleanText(profile.goal, 40),
    activity: cleanText(profile.activity, 40),
    shortTermGoal: cleanText(profile.shortTermGoal, 120),
    longTermGoal: cleanText(profile.longTermGoal, 120),
  };
  const recent = recentWorkouts.slice(0, 7).map((w) => ({ date: w.date, name: cleanText(w.name, 60), type: w.type }));
  const plan = await jsonCompletion({
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Create 3 workouts. ${filterType ? `All must be type ${filterType}.` : 'Mix types (Strength, Cardio, HIIT, Flexibility).'}
${asData('profile', p)}
${asData('recent_workouts', recent.length ? recent : 'none')}`,
      },
    ],
    schema: WorkoutPlan,
    trace,
  });
  const workouts = plan.workouts
    .filter((w) => !filterType || w.type === filterType)
    .map((w) => checkWorkout(w, p));
  return { workouts };
}
