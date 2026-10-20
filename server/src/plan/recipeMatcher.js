// Recipe library matcher (D-19). The recipes were written once (src/data/recipes.json); per request, plain code
// picks the best one for each meal slot from the user's fridge, diet, allergies, goal and meal mode.
// No model call, so a plan takes milliseconds. Slots no recipe fits are left to the AI planner.
import { readFileSync } from 'node:fs';
import { computeMacros } from '../tools/nutrition.js';
import { findFridgeMatch } from '../tools/fridge.js';
import { verifyMeal } from '../agents/nutritionVerifier.js';
import { checkMeal } from '../agents/safetyGuard.js';
import { checkModes, soonToExpire } from '../agents/mealModes.js';

const { recipes } = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8'));
export const RECIPES = recipes;

const round = (n, step) => Math.round(n / step) * step;
const fmtQty = (q) => String(Math.round(q * 100) / 100);

// One serving is scaled toward the calorie target (0.75x to 1.5x, in quarter steps), then by the number of diners.
function portionFactor(recipe, target) {
  if (!target) return 1;
  const kcal = computeMacros(recipe.ingredients).calories;
  if (!kcal) return 1;
  return Math.min(1.5, Math.max(0.75, round(target / kcal, 0.25)));
}

// A recipe in the planner's Meal shape: quantities for all diners, nutrition per serving.
// Optional ingredients (garnishes, extras) are left out when the fridge doesn't have them, and named in the steps.
export function toMeal(recipe, { servings = 1, target = null, fridge = [] } = {}) {
  const portion = portionFactor(recipe, target);
  const keep = recipe.ingredients.filter((i) => !i.optional || findFridgeMatch(fridge, i.name));
  const skipped = recipe.ingredients.filter((i) => !keep.includes(i)).map((i) => i.name);
  const per = keep.map(({ optional, ...i }) => ({ ...i, quantity: i.quantity * portion }));
  const all = per.map((i) => ({ name: i.name, quantity: Math.round(i.quantity * servings * 100) / 100, unit: i.unit }));
  const m = computeMacros(per);
  return {
    name: recipe.name,
    type: recipe.type,
    ingredients: all.map((i) => `${fmtQty(i.quantity)} ${i.unit} ${i.name}`),
    structuredIngredients: all,
    recipe: recipe.steps.map((s, k) => `Step ${k + 1}: ${s}`).join('\n') + (skipped.length ? `\nOptional if you have it: ${skipped.join(', ')}.` : ''),
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    prepTime: `${recipe.prepMinutes} min`,
    missingIngredients: [],
    recipeId: recipe.id,
    portion,
  };
}

// Score one candidate. Higher is better; null means it breaks a hard rule for this user.
function evaluate(recipe, ctx) {
  const meal = verifyMeal(toMeal(recipe, ctx), ctx.fridge, ctx.servings);
  if (checkMeal(meal, ctx.profile, ctx.fridge).violations.length) return null;
  // The diet targets the guard only warns about are hard rules when choosing from the library.
  const diet = String(ctx.profile.diet || '').toLowerCase();
  if (diet === 'low carb' && meal.carbs > 50) return null;
  if (diet === 'high protein' && meal.protein < 20) return null;
  // Per-meal mode rules (prep time, calorie band, items to buy, staples only). Clean out's day target is handled below.
  const { meals: [checked] } = checkModes([meal], { ...ctx, fullDay: false });
  const soon = checked.modeEvidence?.soonUsed ?? [];
  const perMealProblems = (checked.modeViolations || []).filter((v) => !/needs \d+$|but needs/.test(v));
  if (perMealProblems.length) return null;
  // With food in the fridge, a recipe must use some of it; otherwise the AI planner may do better.
  if (ctx.fridge.length && meal.fridgeUtilization === 0) return null;

  const toBuy = meal.missingIngredients.length + meal.shortIngredients.length;
  let score = 3 * meal.fridgeUtilization - 0.7 * toBuy;
  const soonNames = ctx.soon.map((r) => r.name);
  const soonUsed = [...new Set(meal.structuredIngredients.map((i) => findFridgeMatch(ctx.fridge, i.name)).filter((r) => r && soonNames.includes(r.name)).map((r) => r.name))];
  score += (ctx.mode === 'cleanOut' ? 2 : 0.5) * soonUsed.length;
  if (ctx.mode === 'hungry') score -= recipe.prepMinutes / 30;
  if (ctx.profile.approxCaloriesPerMeal) score -= Math.abs(meal.calories - ctx.profile.approxCaloriesPerMeal) / ctx.profile.approxCaloriesPerMeal;
  if (/build muscle/i.test(ctx.profile.goal || '')) score += meal.protein / 60;
  if (/lose fat/i.test(ctx.profile.goal || '') && ctx.profile.approxCaloriesPerMeal) score -= Math.max(0, meal.calories - ctx.profile.approxCaloriesPerMeal) / 500;
  score += ctx.rng() * 0.4; // a little variety, so Refresh doesn't always return the same plan
  return { recipe, meal, score, soonUsed };
}

// Picks one recipe per needed slot. Returns { meals, unfilled } where unfilled lists the slots for the AI planner.
export function matchRecipes({ fridge, profile, neededTypes, servings = 1, mode = null, today, exclude = [], rng = Math.random }) {
  const ctx = { fridge, profile, servings, mode, today, target: profile.approxCaloriesPerMeal, soon: soonToExpire(fridge, today), rng };
  const skip = new Set(exclude);
  const picked = [];
  const usedSoon = new Set();
  const unfilled = [];
  for (const type of neededTypes) {
    const candidates = RECIPES.filter((r) => r.type === type && !skip.has(r.id)).map((r) => evaluate(r, ctx)).filter(Boolean);
    // Clean out across the day: prefer recipes that use expiring items not used yet.
    for (const c of candidates) if (mode === 'cleanOut') c.score += 2 * c.soonUsed.filter((n) => !usedSoon.has(n)).length;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) {
      unfilled.push(type);
      continue;
    }
    best.soonUsed.forEach((n) => usedSoon.add(n));
    picked.push(best.meal);
  }

  // Clean out's day target (6.2): if the picks don't use enough expiring food, hand the slots that use none to the AI.
  if (mode === 'cleanOut' && ctx.soon.length) {
    const required = Math.min(ctx.soon.length <= 3 ? ctx.soon.length : 3, neededTypes.length === 3 ? 3 : picked.length);
    if (usedSoon.size < required) {
      for (const m of [...picked]) {
        const uses = m.structuredIngredients.some((i) => ctx.soon.some((r) => r.name === findFridgeMatch(fridge, i.name)?.name));
        if (!uses) {
          picked.splice(picked.indexOf(m), 1);
          unfilled.push(m.type);
        }
      }
    }
  }
  return { meals: picked, unfilled };
}
