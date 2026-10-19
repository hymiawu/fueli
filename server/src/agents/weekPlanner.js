// Weekly plan (handoff 6.3.3, Neil). The same pattern as meals: the model proposes, plain code checks
// (plan/weekRules.js), one repair round, then a fixed fallback table.
import { jsonCompletion } from '../llm.js';
import { WeekPlan } from '../schemas.js';
import { asData, DATA_RULE, cleanText } from '../guard.js';
import { checkWeekPlan, fallbackPlan } from '../plan/weekRules.js';

const system = (daysPerWeek) => `You are Fueli's workout planner. Write a 7-day plan from Monday to Sunday for this user. Use exactly ${daysPerWeek} training days and make the rest Rest. Never put two days that train the same muscles back to back; Full Body trains everything. Lose Fat must include at least one Cardio day. Beginners and sedentary users get Full Body days, not splits. Give each day a one-line note on why it fits.
${DATA_RULE}
Focus is one of: Full Body, Upper, Push, Pull, Lower, Cardio, Flexibility, Rest.
Return JSON only: {"summary":"","days":[{"day":"Mon","focus":"","note":""}, ...]}`;

// Same profile view the workout coach gets.
export const coachProfile = (profile) => ({
  goal: cleanText(profile.goal, 40),
  activity: cleanText(profile.activity, 40),
  shortTermGoal: cleanText(profile.shortTermGoal, 120),
  longTermGoal: cleanText(profile.longTermGoal, 120),
});

export async function planWeek({ profile, daysPerWeek, trace }, deps = { jsonCompletion }) {
  const p = coachProfile(profile);
  const messages = [{ role: 'user', content: `Plan my week with ${daysPerWeek} training days.\n${asData('profile', p)}` }];
  let plan = await deps.jsonCompletion({ system: system(daysPerWeek), messages, schema: WeekPlan, trace });
  let problems = checkWeekPlan(plan, p, daysPerWeek);
  if (!problems.length) return { ...plan, planSource: 'ai' };

  trace?.flags.push('week_repair');
  plan = await deps.jsonCompletion({
    system: system(daysPerWeek),
    messages: [...messages, { role: 'assistant', content: JSON.stringify(plan) }, { role: 'user', content: `Fix these problems: ${problems.join(' ')} Return the full corrected JSON.` }],
    schema: WeekPlan,
    trace,
  }).catch(() => null);
  problems = plan ? checkWeekPlan(plan, p, daysPerWeek) : ['no plan'];
  if (!problems.length) return { ...plan, planSource: 'ai-repaired' };

  trace?.flags.push('week_fallback');
  return { ...fallbackPlan(p, daysPerWeek), planSource: 'fallback' };
}
