// Meal Planner orchestrator:
//   1. Planner agent (LLM + read-only tools) drafts meals from the user's fridge.
//   2. Nutrition Verifier grounds macros and recomputes fridge usage.
//   3. Safety Guard checks diet rules; violations get one repair round, then are dropped.
import { runAgent, jsonCompletion } from '../llm.js';
import { MealPlan } from '../schemas.js';
import { lookupNutritionTool } from '../tools/nutrition.js';
import { summarizeFridge } from '../tools/fridge.js';
import { asData, DATA_RULE, cleanText } from '../guard.js';
import { verifyMeal } from './nutritionVerifier.js';
import { checkMeal } from './safetyGuard.js';

const SYSTEM = `You are Fueli's meal planner. You plan home-cooked meals that use what is already in the user's fridge and fit their goal and diet.
${DATA_RULE}
Rules:
- MAXIMIZE use of fridge ingredients; prefer items that expire soonest.
- If the fridge is empty or too sparse, still plan complete meals from common groceries; list every ingredient with quantities.
- Strictly respect the diet. Vegetarian: no meat or seafood. Vegan: no animal products at all.
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
  approxCaloriesPerMeal: mealCalorieTarget(p),
});

function finalize(meals, fridge, profile, servings) {
  return meals.map((m) => {
    const verified = verifyMeal(m, fridge, servings);
    const { violations, warnings } = checkMeal(verified, profile);
    return { ...verified, violations, warnings: [...verified.warnings, ...warnings] };
  });
}

// `deps` lets tests replace the model calls; production always uses the real ones.
export async function planMeals({ fridge, profile, neededTypes, servings = 1, trace }, deps = { runAgent, jsonCompletion }) {
  const serves = `Each meal serves ${servings} ${servings === 1 ? 'person' : 'people'}.`;
  const p = profileView(profile);
  const draft = await deps.runAgent({
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Plan exactly ${neededTypes.length} meal(s), one for each of: ${neededTypes.join(', ')}. ${serves}
${asData('profile', p)}
${asData('fridge', summarizeFridge(fridge))}
Call lookup_nutrition for the main ingredients, then return the final JSON.`,
      },
    ],
    tools,
    finalSchema: MealPlan,
    trace,
  });

  let meals = finalize(draft.meals.filter((m) => neededTypes.includes(m.type)), fridge, p, servings);

  // One repair round for hard violations.
  const bad = meals.filter((m) => m.violations.length);
  if (bad.length) {
    trace?.flags.push('diet_repair');
    const repaired = await deps.jsonCompletion({
      system: SYSTEM,
      messages: [
        { role: 'user', content: `${asData('profile', p)}\n${asData('fridge', summarizeFridge(fridge))}` },
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
    meals = meals.map((m) => (m.violations.length ? fixed.find((f) => f.type === m.type) ?? m : m));
  }

  const blocked = meals.filter((m) => m.violations.length);
  if (blocked.length) trace?.flags.push('blocked');
  return {
    meals: meals.filter((m) => !m.violations.length).map(({ violations, ...m }) => m),
    blocked: blocked.map((m) => ({ type: m.type, reason: m.violations.join('; ') })),
  };
}
