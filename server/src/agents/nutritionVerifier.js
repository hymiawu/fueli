// Nutrition Verifier: grounds LLM-claimed macros in the nutrition knowledge base and
// recomputes fridge usage instead of trusting the model's own claim.
import { computeMacros } from '../tools/nutrition.js';
import { fridgeCoverage } from '../tools/fridge.js';

const MIN_COVERAGE = 0.7; // share of ingredients we must be able to price before overriding the model
const MAX_DRIFT = 0.25;

export const atwaterCalories = (m) => Math.round(4 * m.protein + 4 * m.carbs + 9 * m.fat);

export function verifyMeal(meal, fridge) {
  const computed = computeMacros(meal.structuredIngredients);
  const coverage = fridgeCoverage(fridge, meal.structuredIngredients);
  const out = { ...meal, warnings: [...(meal.warnings || [])] };

  if (computed.coverage >= MIN_COVERAGE && computed.calories > 0) {
    // The database is the source of truth whenever it can price the meal.
    const drift = Math.abs(meal.calories - computed.calories) / computed.calories;
    if (drift > MAX_DRIFT) out.claimed = { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };
    Object.assign(out, { calories: computed.calories, protein: computed.protein, carbs: computed.carbs, fat: computed.fat });
    out.macroSource = drift > MAX_DRIFT ? 'corrected' : 'verified';
    if (computed.unmatched.length) out.warnings.push(`Not in nutrition database (not counted): ${computed.unmatched.join(', ')}.`);
  } else {
    out.macroSource = 'estimated';
    // At least make the model's numbers internally consistent.
    const atw = atwaterCalories(meal);
    if (meal.calories > 0 && Math.abs(atw - meal.calories) / meal.calories > 0.2) {
      out.calories = atw;
      out.warnings.push('Calories adjusted to match the listed macros.');
    }
  }

  out.missingIngredients = coverage.missing;
  out.fridgeUtilization = Math.round(coverage.utilization * 100) / 100;
  out.nutritionCoverage = Math.round(computed.coverage * 100) / 100;
  return out;
}
