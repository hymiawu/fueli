# Fueli — Responsible Deployment Notes

## Privacy
**What we hold:** email, height, weight, activity level, goal, diet (Supabase auth metadata); fridge items (Postgres); meal/workout history (on the device only).

| Risk | Mitigation | Where |
|---|---|---|
| One user reading another's data | Row Level Security on `ingredients`. The API queries Supabase **with the user's own JWT**, so RLS applies to the server too. No service-role key exists in the API. | `supabase/migrations/001_ingredients_rls.sql`, `server/src/auth.js` |
| Health data in logs | Logs contain only route name, latency, token counts, tool-call count and flags. No prompts, outputs, emails or images. | `server/src/index.js` |
| Data sent to the model provider | Minimal profile (goal, diet, activity, height/weight) and the fridge list. No name or email. Images are sent at `detail: low` and not stored. OpenAI API data is not used for training by default. | `agents/` |
| Data retention | Images are never persisted. Users can delete fridge items at any time. *Todo:* account deletion endpoint. | |

## Hallucination
| Risk | Mitigation |
|---|---|
| Invented calorie/macro numbers | The **Nutrition Verifier** recomputes macros from a USDA-derived database whenever ≥ 70% of a meal's ingredients resolve, and keeps the model's original numbers in `claimed` when they drift > 25%. The UI shows a "✓ Macros checked against nutrition database" tag only on verified meals. |
| Wrong ingredient from a photo | Scan results are an editable form; nothing is saved until the user confirms. Matched DB values override the model's per-100 g guesses. |
| "Uses your fridge" claims that aren't true | Missing ingredients and fridge utilization are recomputed from the real fridge, not taken from the model. |
| Restaurant food estimates | Always labeled "AI estimate" with the model's confidence level. Eval checks ranges against published values. |
| Malformed output | zod schemas with bounds (e.g. calories 50–3000 per meal), plus one automatic retry with the validation error. |

## Prompt injection
User-controlled text reaches prompts from: fridge item names (typed by the user), outside-food descriptions, workout names, and text inside photos.

- All of it is wrapped in `<user_data>` blocks, with a system rule to treat it as data. Our own delimiter tags are stripped from input, control characters are removed, and lengths are capped (`guard.js`).
- **The model has only read-only tools**, and those tools are scoped to the requesting user by RLS. A successful injection can at worst change suggestion text, not data.
- Deterministic guards run *after* the model, so an injected "ignore the vegetarian rule" is still caught by the Safety Guard.
- Known patterns are flagged (`injection_attempt`) in logs for monitoring.
- Eval cases `M7-injection-in-fridge-name` and `O5-injection` test this on every run.

## Data leakage
- **Keys:** the original app shipped an OpenAI key inside the client bundle. That key is removed from the client and now lives only as a Fly secret. **It should be rotated**, since anyone with an old build could extract it.
- `EXPO_PUBLIC_*` variables hold only publishable values (API URL, Supabase URL and publishable key).
- The system prompt contains no secrets, so a prompt leak exposes nothing sensitive.
- CORS allow-list for browsers. Every route also requires a valid JWT.

## Human oversight
- **Human in the loop for every state change:** scanned items are confirmed before saving, and fridge quantities change only when the user marks a meal as cooked (reversible by unchecking).
- **Blocked meals are surfaced, not hidden:** the user sees which meal was held back and why.
- **Developer oversight:** metadata logs with flags (`schema_retry`, `diet_repair`, `blocked`, `injection_attempt`) can be reviewed with `fly logs`. The eval suite runs before each deploy (`deploy-fueli` skill).
- **Scope disclaimer** in the meal screen: "AI suggestions are general guidance, not medical or dietary advice." The app does not handle allergies; users with allergies should not rely on it.

## Fairness and wellbeing
- No calorie target below a safe floor is generated. Meals under 150 kcal or over 1500 kcal are flagged.
- Workouts are capped in difficulty for sedentary and lightly active users.
- *Known gap:* the food database and prompts skew toward Western ingredients. Long-tail and culturally specific foods fall back to labeled estimates. Expanding the database is listed in the PRD's future work.

## Abuse and cost
Per-user rate limit (30 AI calls / 10 min), body and image size limits, bounded agent steps (≤ 4 tool rounds plus 1 repair), and `max_tokens` on every call.
