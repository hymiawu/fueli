// Safety Guard: rule checks applied to every AI suggestion before the user sees it.

const MEAT = ['chicken', 'beef', 'pork', 'bacon', 'ham', 'turkey', 'lamb', 'steak', 'sausage', 'prosciutto', 'duck', 'veal', 'salami', 'pepperoni', 'gelatin'];
const SEAFOOD = ['fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'cod', 'tilapia', 'anchovy', 'crab', 'lobster', 'sardine', 'scallop', 'fish sauce'];
const ANIMAL = ['egg', 'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'honey', 'whey', 'mayonnaise', 'mayo', 'ghee', 'parmesan', 'mozzarella', 'cheddar', 'feta'];
const PLANT_QUALIFIER = /(almond|soy|oat|coconut|rice|peanut|cashew|plant|vegan|nut|dairy-free|apple|cocoa|shea)[\s-]+$/;

function findTerms(text, terms) {
  const t = ` ${String(text).toLowerCase()} `;
  const hits = [];
  for (const term of terms) {
    const re = new RegExp(`\\b${term}(e?s)?\\b`, 'g');
    let m;
    while ((m = re.exec(t))) {
      if (PLANT_QUALIFIER.test(t.slice(Math.max(0, m.index - 14), m.index))) continue; // "almond milk", "peanut butter"
      hits.push(term);
      break;
    }
  }
  return hits;
}

const mealText = (meal) =>
  [meal.name, ...(meal.ingredients || []), ...(meal.structuredIngredients || []).map((i) => i.name)].join(' | ');

export function checkMeal(meal, profile = {}) {
  const violations = []; // hard: must be fixed or removed
  const warnings = []; // soft: shown to the user
  const diet = String(profile.diet || '').toLowerCase();
  const text = mealText(meal);

  if (diet === 'vegetarian' || diet === 'vegan') {
    const hits = findTerms(text, [...MEAT, ...SEAFOOD]);
    if (hits.length) violations.push(`Not ${diet}: contains ${hits.join(', ')}`);
  }
  if (diet === 'vegan') {
    const hits = findTerms(text, ANIMAL);
    if (hits.length) violations.push(`Not vegan: contains ${hits.join(', ')}`);
  }
  if (diet === 'low carb' && meal.carbs > 50) warnings.push(`High in carbs for a low-carb diet (${meal.carbs} g).`);
  if (diet === 'high protein' && meal.protein < 20) warnings.push(`Low protein for a high-protein diet (${meal.protein} g).`);

  if (meal.calories < 150 || meal.calories > 1500) warnings.push(`Unusual calorie count (${meal.calories} kcal) — double-check portions.`);
  if (String(profile.goal || '').toLowerCase() === 'lose fat' && meal.calories > 900)
    warnings.push('Large portion for a fat-loss goal.');

  for (const t of findTerms(meal.recipe || '', ['raw chicken', 'raw pork', 'undercooked'])) warnings.push(`Food-safety note: recipe mentions "${t}".`);

  return { violations, warnings };
}

const MAX_DIFFICULTY = { sedentary: 'Beginner', 'lightly active': 'Intermediate' };
const LEVEL = { Beginner: 0, Intermediate: 1, Advanced: 2 };

export function checkWorkout(workout, profile = {}) {
  const warnings = [];
  const cap = MAX_DIFFICULTY[String(profile.activity || '').toLowerCase()];
  let difficulty = workout.difficulty;
  if (cap && LEVEL[difficulty] > LEVEL[cap]) {
    warnings.push(`Scaled from ${difficulty} to ${cap} for your activity level — build up gradually.`);
    difficulty = cap;
  }
  const minutes = parseInt(workout.duration, 10);
  if (minutes > 120) warnings.push('Very long session — split it up if you are new to training.');
  return { ...workout, difficulty, warnings };
}
