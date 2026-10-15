import express from 'express';
import cors from 'cors';
import { requireUser, loadFridge } from './auth.js';
import { rateLimit } from './rateLimit.js';
import { newTrace, modelName } from './llm.js';
import { cleanImage } from './guard.js';
import { MealRequest, WorkoutRequest, ScanRequest, OutsideRequest } from './schemas.js';
import { planMeals } from './agents/mealPlanner.js';
import { suggestWorkouts } from './agents/workoutCoach.js';
import { scanIngredient, analyzeOutsideFood } from './agents/vision.js';

for (const k of ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
  if (!process.env[k]) console.warn(`[config] missing ${k}`);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    // Native apps send no Origin header. Browsers must come from an allowed origin
    // (entries may use a leading wildcard, e.g. https://*.vercel.app for preview deploys).
    origin: (origin, cb) =>
      cb(null, !origin || allowed.some((a) => (a.startsWith('https://*.') ? origin.endsWith(a.slice(9)) && origin.startsWith('https://') : a === origin))),
  }),
);
app.use(express.json({ limit: '8mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, model: modelName }));

// Wrap an AI handler: validate body, trace usage, log metadata only (never content or user data).
const ai = (name, schema, handler) => [
  requireUser,
  rateLimit,
  async (req, res) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
    const trace = newTrace(name);
    const started = Date.now();
    try {
      const result = await handler(req, parsed.data, trace);
      res.json(result);
    } catch (e) {
      trace.flags.push('error');
      res.status(e.status || 500).json({ error: e.status && e.status < 500 ? e.message : 'AI request failed' });
      if (!e.status) console.error(`[${name}]`, e.message);
    } finally {
      const { calls, inputTokens, outputTokens, toolCalls, flags } = trace;
      console.log(JSON.stringify({ evt: 'ai', name, ms: Date.now() - started, calls, inputTokens, outputTokens, toolCalls, flags }));
    }
  },
];

app.post(
  '/v1/meals/suggest',
  ...ai('meals', MealRequest, async (req, body, trace) => {
    const fridge = await loadFridge(req);
    return planMeals({ fridge, profile: req.user.user_metadata || {}, neededTypes: body.neededTypes, trace });
  }),
);

app.post(
  '/v1/workouts/suggest',
  ...ai('workouts', WorkoutRequest, (req, body, trace) =>
    suggestWorkouts({ profile: req.user.user_metadata || {}, recentWorkouts: body.recentWorkouts, filterType: body.filterType ?? null, trace }),
  ),
);

app.post(
  '/v1/ingredients/scan',
  ...ai('scan', ScanRequest, (req, body, trace) => scanIngredient({ image: cleanImage(body.image), trace })),
);

app.post(
  '/v1/food/analyze',
  ...ai('outside_food', OutsideRequest, (req, body, trace) => {
    if (!body.text && !body.image) throw Object.assign(new Error('Describe the food or add a photo'), { status: 400 });
    return analyzeOutsideFood({ text: body.text, image: cleanImage(body.image), trace });
  }),
);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const port = Number(process.env.PORT || 8080);
app.listen(port, '0.0.0.0', () => console.log(`fueli-api listening on :${port}`));
