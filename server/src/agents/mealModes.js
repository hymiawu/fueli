// Meal modes (handoff 6.2, Sara's rules; D-17, D-40, D-41, D-43). The mode changes the planner's priorities
// and adds deterministic checks. It adds no model call: a failed check joins the diet and allergy problems
// in the planner's single repair round, and a meal that still fails is held back with Sara's message.
import { findFridgeMatch, daysToExpiry } from '../tools/fridge.js';
import { checkMeal } from './safetyGuard.js';

export const MODES = ['hungry', 'healthy', 'cleanOut'];
export const MODE_LABELS = { hungry: 'Feeling hungry', healthy: 'Feeling healthy', cleanOut: 'Clean out my fridge' };

// Prompt text as Sara wrote it in 6.2.
export const MODE_PROMPTS = {
  hungry: 'Feeling hungry: Make a practical meal in 20 minutes or less with the fewest useful steps. Prefer a meal fully covered by the fridge in both ingredient and comparable quantity, with an empty missingIngredients list. If that is impossible, minimize the shopping list and use no more than two missing ingredients. Do not claim that an ingredient quantity is sufficient when its unit cannot be compared with the fridge unit.',
  healthy: 'Feeling healthy: Keep each serving within +/-20% of approxCaloriesPerMeal and use no more than three missing ingredients. For Build Muscle, prefer the higher-protein candidate within the calorie band. For Lose Fat, prefer the lower half of the band. For Maintain Weight or Eat Healthier, prefer balanced macros. Shopping is allowed; list every item that is not in the fridge.',
  cleanOut: 'Clean out my fridge: Prioritize distinct fridge items expiring today or within three days. In a full-day plan, use all of them when there are one to three and at least three when there are more than three. Use practical quantities; do not force a whole package into a meal. Add only pantry staples. Undated items may support the recipe but do not count toward the expiry target. If no item expires within three days, use the earliest dated items; if there are no valid dates, maximize distinct fridge ingredients.',
};

// What the user sees when a meal is held back after the repair round (6.2.2 messages 2 and 3).
export const HELD_BACK = {
  hungry: 'Your fridge cannot make a complete meal in 20 minutes with two or fewer additional ingredients.',
  healthy: 'We could not build a meal within your calorie range. Try refreshing or updating your goal.',
  cleanOut: 'We could not use enough of the food that expires soon with only pantry staples.',
};
// Plan notes for Clean out (6.2.2 messages 4 and 5).
export const NOTES = {
  noneSoon: 'Nothing expires in the next 3 days, so we used your earliest-dated ingredients instead.',
  noDates: 'No expiry dates are available, so we used as many different fridge ingredients as possible.',
};

const HUNGRY_MAX_MIN = 20;
const HUNGRY_MAX_TO_BUY = 2;
const HEALTHY_BAND = 0.2;
const HEALTHY_MAX_TO_BUY = 3;
const SOON_DAYS = 3;
const CLEAN_OUT_TARGET = 3;

// "20 min", "15 minutes", "1 hr 10 min", "25-30 min" (the upper end counts). null when there is no number.
export function parseMinutes(prepTime) {
  const t = String(prepTime || '').toLowerCase();
  const range = /(\d+)\s*(?:-|–|to)\s*(\d+)\s*(h|hr|hour|m|min)/.exec(t);
  if (range) return Number(range[2]) * (range[3].startsWith('h') ? 60 : 1);
  const h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/.exec(t);
  const m = /(\d+)\s*(?:m|min|mins|minute|minutes)\b/.exec(t);
  if (!h && !m) return null;
  return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
}

// Fridge items expiring today or within three days, soonest first (distinct by name). Items the user can't eat
// (diet or allergy) don't count: a vegetarian's expiring bacon can't be part of the target.
const edible = (row, profile) =>
  !profile || !checkMeal({ name: '', ingredients: [], structuredIngredients: [{ name: row.name }], calories: 400 }, profile, [row]).violations.length;

export function soonToExpire(fridge, today, profile = null) {
  const seen = new Set();
  return fridge
    .map((row) => ({ row, days: daysToExpiry(row.expiry, today) }))
    .filter(({ row, days }) => days !== null && days >= 0 && days <= SOON_DAYS && edible(row, profile))
    .sort((a, b) => a.days - b.days)
    .filter(({ row }) => {
      const key = String(row.name).toLowerCase();
      return !seen.has(key) && seen.add(key);
    })
    .map(({ row }) => row);
}

// The user-message block for a mode: Sara's rule, plus the dates the rule needs.
export function modeBlock(mode, fridge, today, profile = null) {
  if (!MODES.includes(mode)) return '';
  let extra = '';
  if (mode === 'cleanOut') {
    const soon = soonToExpire(fridge, today, profile).map((r) => r.name);
    extra = `\nToday is ${today}. Fridge items expiring within 3 days: ${soon.length ? soon.join(', ') : 'none'}.`;
  }
  return `Mode for this request. ${MODE_PROMPTS[mode]}${extra}`;
}

const toBuyCount = (m) => (m.missingIngredients?.length || 0) + (m.shortIngredients?.length || 0);

// Adds `modeViolations` (detailed text for the repair prompt) and `modeEvidence` (for the meal card).
// `fullDay` is true when all three meal types were requested.
export function checkModes(meals, { mode, profile, fridge, today, fullDay }) {
  if (!MODES.includes(mode)) return { meals: meals.map((m) => ({ ...m, modeViolations: [] })), note: null };

  if (mode === 'hungry') {
    return {
      note: null,
      meals: meals.map((m) => {
        const minutes = parseMinutes(m.prepTime);
        const toBuy = toBuyCount(m);
        const v = [];
        if (minutes === null) v.push('prep time is missing; give one of 20 minutes or less');
        else if (minutes > HUNGRY_MAX_MIN) v.push(`takes ${minutes} minutes; Feeling hungry allows at most ${HUNGRY_MAX_MIN}`);
        if (toBuy > HUNGRY_MAX_TO_BUY) v.push(`needs ${toBuy} ingredients to buy; Feeling hungry allows at most ${HUNGRY_MAX_TO_BUY}`);
        return { ...m, modeViolations: v, modeEvidence: { prepMinutes: minutes, toBuy } };
      }),
    };
  }

  if (mode === 'healthy') {
    const target = profile.approxCaloriesPerMeal; // null without a weight: skip the calorie band
    return {
      note: null,
      meals: meals.map((m) => {
        const toBuy = toBuyCount(m);
        const v = [];
        if (target && Math.abs(m.calories - target) > target * HEALTHY_BAND)
          v.push(`${m.calories} kcal per serving is outside ${Math.round(target * (1 - HEALTHY_BAND))}-${Math.round(target * (1 + HEALTHY_BAND))} kcal`);
        if (toBuy > HEALTHY_MAX_TO_BUY) v.push(`needs ${toBuy} ingredients to buy; Feeling healthy allows at most ${HEALTHY_MAX_TO_BUY}`);
        return { ...m, modeViolations: v, modeEvidence: { calories: m.calories, protein: m.protein, toBuy } };
      }),
    };
  }

  // Clean out my fridge
  const soon = soonToExpire(fridge, today, profile);
  const soonNames = new Set(soon.map((r) => r.name));
  const usedSoon = meals.map((m) => [
    ...new Set((m.structuredIngredients || []).map((i) => findFridgeMatch(fridge, i.name)).filter((r) => r && soonNames.has(r.name)).map((r) => r.name)),
  ]);
  const distinct = new Set(usedSoon.flat());
  const target = soon.length <= CLEAN_OUT_TARGET ? soon.length : CLEAN_OUT_TARGET;
  const required = fullDay ? target : Math.min(target, meals.length);
  const short = soon.length > 0 && distinct.size < required;
  const unused = soon.filter((r) => !distinct.has(r.name)).map((r) => r.name);
  // The meals to change are the ones that use none of those items (all of them if every meal uses one).
  const blame = meals.map((_, i) => usedSoon[i].length === 0);
  const blameAll = !blame.some(Boolean);
  const hasDated = fridge.some((r) => daysToExpiry(r.expiry, today) !== null && daysToExpiry(r.expiry, today) >= 0);

  return {
    note: soon.length ? null : hasDated ? NOTES.noneSoon : NOTES.noDates,
    meals: meals.map((m, i) => {
      const v = [];
      if (m.missingIngredients?.length) v.push(`buys ${m.missingIngredients.join(', ')}; Clean out my fridge allows pantry staples only`);
      if (short && (blame[i] || blameAll))
        v.push(`the day uses ${distinct.size} of the food expiring within 3 days but needs ${required}; use ${unused.slice(0, required).join(', ')}`);
      return { ...m, modeViolations: v, modeEvidence: { soonUsed: usedSoon[i] } };
    }),
  };
}
