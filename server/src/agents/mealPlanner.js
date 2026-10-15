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
- Use the lookup_nutrition tool to get per-100g values for main ingredients, and base calories/macros on them.
- structuredIngredients names must match fridge item names when the item comes from the fridge, using units g, ml, piece, cup or tbsp.
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

const profileView = (p) => ({
  goal: cleanText(p.goal || 'Eat Healthier', 40),
  diet: cleanText(p.diet || 'No Restriction', 40),
  activity: cleanText(p.activity || '', 40),
  heightCm: Number(p.height) || null,
  weightKg: Number(p.weight) || null,
});

function finalize(meals, fridge, profile) {
  return meals.map((m) => {
    const verified = verifyMeal(m, fridge);
    const { violations, warnings } = checkMeal(verified, profile);
    return { ...verified, violations, warnings: [...verified.warnings, ...warnings] };
  });
}

export async function planMeals({ fridge, profile, neededTypes, trace }) {
  const p = profileView(profile);
  const draft = await runAgent({
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Plan exactly ${neededTypes.length} meal(s), one for each of: ${neededTypes.join(', ')}.
${asData('profile', p)}
${asData('fridge', summarizeFridge(fridge))}
Call lookup_nutrition for the main ingredients, then return the final JSON.`,
      },
    ],
    tools,
    finalSchema: MealPlan,
    trace,
  });

  let meals = finalize(draft.meals.filter((m) => neededTypes.includes(m.type)), fridge, p);

  // One repair round for hard violations.
  const bad = meals.filter((m) => m.violations.length);
  if (bad.length) {
    trace?.flags.push('diet_repair');
    const repaired = await jsonCompletion({
      system: SYSTEM,
      messages: [
        { role: 'user', content: `${asData('profile', p)}\n${asData('fridge', summarizeFridge(fridge))}` },
        {
          role: 'user',
          content: `These meals broke the rules and must be replaced with compliant meals of the same type:\n${bad
            .map((m) => `- ${m.type}: "${m.name}" — ${m.violations.join('; ')}`)
            .join('\n')}\nReturn {"meals":[...]} with only the replacements.`,
        },
      ],
      schema: MealPlan,
      trace,
    });
    const fixed = finalize(repaired.meals, fridge, p);
    meals = meals.map((m) => (m.violations.length ? fixed.find((f) => f.type === m.type) ?? m : m));
  }

  const blocked = meals.filter((m) => m.violations.length);
  if (blocked.length) trace?.flags.push('blocked');
  return {
    meals: meals.filter((m) => !m.violations.length).map(({ violations, ...m }) => m),
    blocked: blocked.map((m) => ({ type: m.type, reason: m.violations.join('; ') })),
  };
}
