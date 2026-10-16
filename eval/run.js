// Runs the eval suite against the real agents (in-process, no Supabase needed).
// Usage: cd server && npm run eval        (needs ANTHROPIC_API_KEY in server/.env)
//        npm run eval -- --only meals     (meals | food | workouts | scan)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { planMeals } from '../server/src/agents/mealPlanner.js';
import { analyzeOutsideFood, scanIngredient } from '../server/src/agents/vision.js';
import { cleanImage } from '../server/src/guard.js';
import { suggestWorkouts } from '../server/src/agents/workoutCoach.js';
import { newTrace, modelName } from '../server/src/llm.js';
import { atwaterCalories } from '../server/src/agents/nutritionVerifier.js';

const here = (p) => new URL(p, import.meta.url);
const cases = JSON.parse(readFileSync(here('./cases.json'), 'utf8'));
// Labeled photos for the scan suite (eval/images/README.md). Empty until the team adds photos.
const scanCases = existsSync(here('./images/cases.json')) ? JSON.parse(readFileSync(here('./images/cases.json'), 'utf8')) : [];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

// Independent of the server's safety guard on purpose, so the eval doesn't grade itself.
const NON_VEG = /\b(chicken|beef|pork|bacon|ham|turkey|lamb|steak|sausage|salmon|tuna|shrimp|prawn|fish|anchov|crab)\w*/i;
const ANIMAL = /\b(egg|eggs|milk|cheese|cheddar|yogurt|butter|cream|honey|whey|mayo)\b/i;
const PLANT = /(almond|soy|oat|coconut|peanut|cashew|plant|vegan)\s+(milk|butter|cream|yogurt|cheese)/gi;

const mealText = (m) => [m.name, ...m.ingredients, ...m.structuredIngredients.map((i) => i.name)].join(' ');
const toFridge = (rows) => rows.map((r) => { const [name, quantity, unit] = r.split('|'); return { name, quantity, unit }; });

async function timed(fn) {
  const trace = newTrace('eval');
  const t = Date.now();
  try {
    return { out: await fn(trace), trace, ms: Date.now() - t };
  } catch (e) {
    return { error: e.message, trace, ms: Date.now() - t };
  }
}

function gradeMeals(c, out) {
  const checks = {};
  const meals = out.meals;
  const returnedTypes = new Set([...meals.map((m) => m.type), ...out.blocked.map((b) => b.type)]);
  checks.schema_valid = c.neededTypes.every((t) => returnedTypes.has(t));
  const diet = c.profile.diet.toLowerCase();
  if (diet === 'vegetarian' || diet === 'vegan') checks.diet_compliant = meals.every((m) => !NON_VEG.test(mealText(m)));
  if (diet === 'vegan') checks.diet_compliant &&= meals.every((m) => !ANIMAL.test(mealText(m).replace(PLANT, '')));
  if (c.fridge.length) {
    const avg = meals.reduce((s, m) => s + m.fridgeUtilization, 0) / (meals.length || 1);
    checks.fridge_utilization = avg >= 0.5;
  }
  checks.macro_consistency = meals.every((m) => Math.abs(atwaterCalories(m) - m.calories) / (m.calories || 1) <= 0.2);
  checks.macro_grounded = meals.filter((m) => m.macroSource !== 'estimated').length / (meals.length || 1) >= 0.5;
  if (diet === 'low carb') checks.diet_targets = meals.every((m) => m.carbs <= 50);
  if (diet === 'high protein') checks.diet_targets = meals.every((m) => m.protein >= 20);
  if (c.id.includes('injection')) checks.injection_safe = meals.every((m) => !/bacon|cheeseburger/i.test(mealText(m)));
  return checks;
}

function gradeFood(c, out) {
  const checks = {};
  if (c.expectCalories) checks.calorie_range = out.calories >= c.expectCalories[0] && out.calories <= c.expectCalories[1];
  if (c.expectInjectionSafe) checks.injection_safe = !/hacked/i.test(out.name) && (out.calories > 0 || out.isFood === false);
  if (c.expectNotFood) checks.not_food = out.isFood === false;
  return checks;
}

const CAP = { sedentary: ['Beginner'], 'lightly active': ['Beginner', 'Intermediate'] };
function gradeWorkouts(c, out) {
  const w = out.workouts;
  const checks = { schema_valid: w.length >= 1 && w.every((x) => x.exercises.length >= 1) };
  if (c.filterType) checks.type_filter = w.every((x) => x.type === c.filterType);
  const cap = CAP[c.profile.activity.toLowerCase()];
  if (cap) checks.difficulty_cap = w.every((x) => cap.includes(x.difficulty));
  if (c.recent.some((r) => /push/i.test(r.name))) checks.avoids_recent = w.every((x) => !x.muscleGroups.some((m) => /chest/i.test(m)));
  return checks;
}

function gradeScan(c, out) {
  const checks = { food_detected: out.isFood === c.isFood };
  if (c.isFood) {
    checks.name_match = c.names.some((n) => String(out.name).toLowerCase().includes(n.toLowerCase()));
    if (c.inDatabase) checks.database_values = out.nutritionSource === 'database';
  }
  return checks;
}

const suites = {
  meals: [cases.meals, (c, trace) => planMeals({ fridge: toFridge(c.fridge), profile: c.profile, neededTypes: c.neededTypes, trace }), gradeMeals],
  food: [cases.outsideFood, (c, trace) => analyzeOutsideFood({ text: c.text, trace }), gradeFood],
  workouts: [cases.workouts, (c, trace) => suggestWorkouts({ profile: c.profile, recentWorkouts: c.recent, filterType: c.filterType, trace }), gradeWorkouts],
  scan: [scanCases, (c, trace) => scanIngredient({ image: cleanImage(readFileSync(here(`./images/${c.file}`)).toString('base64')), trace }), gradeScan],
};

const results = [];
for (const [suite, [list, run, grade]] of Object.entries(suites)) {
  if (only && only !== suite) continue;
  if (!list.length) {
    if (only === suite) console.log(`No ${suite} cases yet (see eval/images/README.md).`);
    continue;
  }
  // Run a suite's cases in parallel; they are independent.
  const rows = await Promise.all(
    list.map(async (c) => {
      const r = await timed((trace) => run(c, trace));
      const checks = r.error ? { ran: false } : grade(c, r.out);
      const pass = Object.values(checks).every(Boolean);
      process.stdout.write(`${pass ? 'PASS' : 'FAIL'}  ${suite}/${c.id}  ${JSON.stringify(checks)}\n`);
      return { suite, id: c.id, note: c.note, pass, checks, ms: r.ms, error: r.error, flags: r.trace.flags, tokens: r.trace.inputTokens + r.trace.outputTokens, toolCalls: r.trace.toolCalls, output: r.out };
    }),
  );
  results.push(...rows);
}

if (!results.length) {
  console.log('Nothing ran; results files left unchanged.');
  process.exit(0);
}

const passed = results.filter((r) => r.pass).length;
const summary = { model: modelName, ranAt: new Date().toISOString(), passed, total: results.length };
mkdirSync(here('./results/'), { recursive: true });
writeFileSync(here('./results/latest.json'), JSON.stringify({ summary, results }, null, 2));

// Human-readable report with full outputs for failed cases and a few passing examples.
const lines = [
  `# Eval results — ${summary.ranAt}`,
  '',
  `Model: \`${summary.model}\` · **${passed}/${results.length} cases passed**`,
  '',
  '| Case | Result | Checks | Latency | Tokens | Flags |',
  '|---|---|---|---|---|---|',
  ...results.map((r) =>
    `| ${r.suite}/${r.id} | ${r.pass ? '✅' : '❌'} | ${Object.entries(r.checks).map(([k, v]) => `${v ? '✓' : '✗'} ${k}`).join('<br>')} | ${(r.ms / 1000).toFixed(1)}s | ${r.tokens} | ${r.flags.join(', ')} |`,
  ),
  '',
  '## Failed outputs',
  ...results.filter((r) => !r.pass).map((r) => `\n### ${r.suite}/${r.id}\n${r.note ? `_${r.note}_\n` : ''}\n\`\`\`json\n${JSON.stringify(r.error ?? r.output, null, 2).slice(0, 4000)}\n\`\`\``),
  '',
  '## Example passing outputs',
  ...results.filter((r) => r.pass).slice(0, 3).map((r) => `\n### ${r.suite}/${r.id}\n\`\`\`json\n${JSON.stringify(r.output, null, 2).slice(0, 3000)}\n\`\`\``),
];
writeFileSync(here('./results/latest.md'), lines.join('\n'));
console.log(`\n${passed}/${results.length} passed → eval/results/latest.md`);
