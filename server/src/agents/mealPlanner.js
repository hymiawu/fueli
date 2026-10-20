// Meal Planner orchestrator:
//   1. Planner agent (LLM + read-only tools) drafts meals from the user's fridge.
//   2. Nutrition Verifier grounds macros and recomputes fridge usage.
//   3. Safety Guard checks diet rules; violations get one repair round, then are dropped.
import { runAgent, jsonCompletion } from '../llm.js';
import { MealPlan } from '../schemas.js';
import { lookupNutritionTool } from '../tools/nutrition.js';
import { summarizeFridge } from '../tools/fridge.js';
import { asData, DATA_RULE, cleanText } from '../guard.js';
import { ALLERGENS } from '../schemas.js';
import { verifyMeal } from './nutritionVerifier.js';
import { checkMeal } from './safetyGuard.js';
import { checkModes, modeBlock, HELD_BACK } from './mealModes.js';
import { matchRecipes } from '../plan/recipeMatcher.js';

const SYSTEM = `You are Fueli's meal planner. You plan home-cooked meals that use what is already in the user's fridge and fit their goal and diet.
${DATA_RULE}
Rules:
- MAXIMIZE use of fridge ingredients; prefer items that expire soonest.
- If the fridge is empty or too sparse, still plan complete meals from common groceries; list every ingredient with quantities.
- Strictly respect the diet. Vegetarian: no meat or seafood. Vegan: no animal products at all.
- Never use an ingredient that contains one of the profile's allergies, including fridge items whose allergens list it.
- When the profile gives approxCaloriesPerMeal, aim each meal's per-serving calories near it.
- Use the lookup_nutrition tool to get per-100g values for main ingredients, and base calories/macros on them.
- structuredIngredients names must match fridge item names when the item comes from the fridge, using units g, ml, piece, cup or tbsp.
- Use g for meat, fish, tofu, grains, leafy greens, berries and chopped vegetables. Use piece only for whole countable items such as eggs, whole fruit, a head of broccoli or an ear of corn.
- The user message says how many people each meal serves. Ingredient quantities are for all servings together; calories, protein, carbs and fat are per serving.
- Keep recipes practical (under 60 minutes) and write steps as "Step 1: ...\\nStep 2: ...".
Final JSON format:
{"meals":[{"name":"","type":"Breakfast|Lunch|Dinner","ingredients":["200g chicken breast"],"structuredIngredients":[{"name":"chicken breast","quantity":200,"unit":"g"}],"recipe":"Step 1: ...","calories":0,"protein":0,"carbs":0,"fat":0,"prepTime":"20 min","missingIngredients":[]}]}`;

const tools = {
  lookup_nutrition: {
    description: 'Look up per-100g calories, protein, carbs and fat for ingredients in the nutrition database.',
    parameters: {
      type: 'object',
      properties: { names: { type: 'array', items: { type: 'string' }, maxItems: 20 } },
      required: ['names'],
      additionalProperties: false,
    },
    run: lookupNutritionTool,
  },
};

// Rough kcal per kg of body weight per day by activity level, and goal adjustments.
const KCAL_PER_KG = { sedentary: 28, 'lightly active': 31, 'moderately active': 34, 'very active': 37 };
const GOAL_FACTOR = { 'lose fat': 0.8, 'build muscle': 1.1 };

// Approximate calories per meal (3 meals a day), rounded to 50 kcal. Computed here so the
// user's body measurements never reach the model.
export function mealCalorieTarget(p) {
  const kg = Number(p.weight);
  if (!(kg >= 30 && kg <= 300)) return null;
  const perKg = KCAL_PER_KG[String(p.activity || '').toLowerCase()] ?? 31;
  const daily = kg * perKg * (GOAL_FACTOR[String(p.goal || '').toLowerCase()] ?? 1);
  return Math.round(daily / 3 / 50) * 50;
}

// What the model sees about the user: preferences and a calorie target, never height or weight.
const profileView = (p) => ({
  goal: cleanText(p.goal || 'Eat Healthier', 40),
  diet: cleanText(p.diet || 'No Restriction', 40),
  activity: cleanText(p.activity || '', 40),
  allergies: (Array.isArray(p.allergies) ? p.allergies : []).filter((a) => ALLERGENS.includes(a)),
  approxCaloriesPerMeal: mealCalorieTarget(p),
});

// Verifier, then the guard's diet and allergy rules (`ruleViolations`).
function finalize(meals, fridge, profile, servings) {
  return meals.map((m) => {
    const verified = verifyMeal(m, fridge, servings);
    const { violations, warnings } = checkMeal(verified, profile, fridge);
    return { ...verified, ruleViolations: violations, warnings: [...verified.warnings, ...warnings] };
  });
}

// Mode checks run over the whole set of meals (Clean out counts across the day), then join the rule violations.
function evaluate(meals, ctx) {
  const { meals: checked, note } = checkModes(meals, ctx);
  return { note, meals: checked.map((m) => ({ ...m, violations: [...m.ruleViolations, ...m.modeViolations] })) };
}

const utcToday = () => new Date().toISOString().slice(0, 10);

// The recipe library (D-19) is used first unless RECIPE_LIBRARY=off or the caller passes useLibrary: false.
const libraryOn = () => process.env.RECIPE_LIBRARY !== 'off';

// `deps` lets tests replace the model calls; production always uses the real ones.
// `mode` is one of MODES; without it (older callers, the original eval cases) no mode rules apply.
// Recipes come from the library when one fits each slot; only the slots it can't fill go to the AI planner.
export async function planMeals(args, deps = { runAgent, jsonCompletion }) {
  const { fridge, profile, neededTypes, servings = 1, mode = null, today = utcToday(), exclude = [], useLibrary = libraryOn(), rng, trace } = args;
  if (!useLibrary) return { ...(await planWithAI({ ...args, today }, deps)), source: 'ai' };

  const p = profileView(profile);
  const lib = matchRecipes({ fridge, profile: p, neededTypes, servings, mode, today, exclude, rng });
  const libMeals = finalize(lib.meals, fridge, p, servings).map(({ ruleViolations, ...m }) => ({ ...m, recipeSource: 'library' }));
  const libNote = checkModes(libMeals, { mode, profile: p, fridge, today, fullDay: neededTypes.length === 3 }).note;
  const withEvidence = checkModes(libMeals, { mode, profile: p, fridge, today, fullDay: false }).meals.map(({ modeViolations, ...m }) => m);
  if (!lib.unfilled.length) {
    trace?.flags.push('library');
    return { mode, modeNote: libNote, meals: withEvidence, blocked: [], source: 'library' };
  }
  trace?.flags.push(withEvidence.length ? 'library_partial' : 'library_none');
  const ai = await planWithAI({ ...args, neededTypes: lib.unfilled, today }, deps);
  const order = (m) => ['Breakfast', 'Lunch', 'Dinner'].indexOf(m.type);
  return {
    mode,
    modeNote: libNote ?? ai.modeNote,
    meals: [...withEvidence, ...ai.meals.map((m) => ({ ...m, recipeSource: 'ai' }))].sort((a, b) => order(a) - order(b)),
    blocked: ai.blocked,
    source: withEvidence.length ? 'library+ai' : 'ai',
  };
}

async function planWithAI({ fridge, profile, neededTypes, servings = 1, mode = null, today = utcToday(), trace }, deps) {
  const serves = `Each meal serves ${servings} ${servings === 1 ? 'person' : 'people'}.`;
  const p = profileView(profile);
  const block = modeBlock(mode, fridge, today);
  const ctx = { mode, profile: p, fridge, today, fullDay: neededTypes.length === 3 };
  const draft = await deps.runAgent({
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Plan exactly ${neededTypes.length} meal(s), one for each of: ${neededTypes.join(', ')}. ${serves}
${block ? `${block}\n` : ''}${asData('profile', p)}
${asData('fridge', summarizeFridge(fridge))}
Call lookup_nutrition for the main ingredients, then return the final JSON.`,
      },
    ],
    tools,
    finalSchema: MealPlan,
    trace,
  });

  let { meals, note } = evaluate(finalize(draft.meals.filter((m) => neededTypes.includes(m.type)), fridge, p, servings), ctx);

  // One shared repair round for diet, allergy and mode problems (D-41).
  const bad = meals.filter((m) => m.violations.length);
  if (bad.length) {
    trace?.flags.push(bad.some((m) => m.ruleViolations.length) ? 'diet_repair' : 'mode_repair');
    const repaired = await deps.jsonCompletion({
      system: SYSTEM,
      messages: [
        { role: 'user', content: `${block ? `${block}\n` : ''}${asData('profile', p)}\n${asData('fridge', summarizeFridge(fridge))}` },
        {
          role: 'user',
          content: `These meals broke the rules and must be replaced with compliant meals of the same type:\n${bad
            .map((m) => `- ${m.type}: "${m.name}" — ${m.violations.join('; ')}`)
            .join('\n')}\n${serves}\nReturn {"meals":[...]} with only the replacements.`,
        },
      ],
      schema: MealPlan,
      trace,
    });
    const fixed = finalize(repaired.meals, fridge, p, servings);
    const merged = meals.map((m) => (m.violations.length ? fixed.find((f) => f.type === m.type) ?? m : m));
    ({ meals, note } = evaluate(merged, ctx));
  }

  const blocked = meals.filter((m) => m.violations.length);
  if (blocked.length) trace?.flags.push('blocked');
  // Held back with the diet or allergy reason, or Sara's message for a mode rule (6.2.2).
  const reason = (m) => [...m.ruleViolations, ...(m.modeViolations.length ? [HELD_BACK[mode]] : [])].join('; ');
  return {
    mode,
    modeNote: note,
    meals: meals.filter((m) => !m.violations.length).map(({ violations, ruleViolations, modeViolations, ...m }) => m),
    blocked: blocked.map((m) => ({ type: m.type, reason: reason(m) })),
  };
}
