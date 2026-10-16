# Fueli — Product Requirements Document

**Status:** Capstone build · **Platforms:** Web (Vercel), iOS/Android (Expo) · **API:** Fly.io

## 1. Goals and non-goals
**Goals**
- G1. Generate a day of meals from the user's actual fridge contents that respect their diet and goal.
- G2. Show calorie/macro numbers grounded in a nutrition database whenever possible, and label estimates as estimates.
- G3. Suggest workouts appropriate to goal, activity level and recent training.
- G4. Keep all model keys and AI logic server-side; keep user data isolated per user.
- G5. Gate the AI features behind a Stripe subscription (test mode) so the product is ready to charge.

**Non-goals**
- Medical nutrition therapy, allergy guarantees, or clinical calorie targets.
- Barcode scanning, grocery delivery, social features.
- Fine-tuning a model.

## 2. Users and stories
| ID | As a… | I want to… | So that… |
|---|---|---|---|
| U1 | home cook | photograph an ingredient and have it added to my fridge | I don't type everything |
| U2 | busy student | get breakfast, lunch and dinner from what I already have | I waste less and order less takeout |
| U3 | vegetarian | never be shown meat, even if my roommate's chicken is in the fridge | I can trust the app |
| U4 | someone tracking macros | see whether the numbers were verified or estimated | I know how much to trust them |
| U5 | cook | mark a meal as cooked and have the fridge update | my inventory stays accurate |
| U6 | person who ate out | log a restaurant meal by text or photo | my day's intake is complete |
| U7 | beginner | get workouts I can actually do | I don't get hurt or discouraged |
| U8 | new user | subscribe in under a minute | I can start using the app right away |

## 3. Functional requirements

### 3.1 Fridge
- FR-1 Add an item manually (name, quantity, unit, category, optional expiry).
- FR-2 Scan an item: `POST /v1/ingredients/scan` with a base64 image → `{name, quantity, unit, category, calories, protein, carbs, fat (per 100 g), nutritionSource}`. If the item matches the nutrition DB, its per-100 g values **replace** the model's. Non-food photos return `isFood: false`.
- FR-3 The user reviews and edits scan results before saving (human in the loop).

### 3.2 Meal planner — `POST /v1/meals/suggest`
- Input: `{ neededTypes: ["Breakfast"|"Lunch"|"Dinner"] }`. The server loads the fridge (Supabase, as the user) and the profile (Supabase auth metadata) itself, so the client cannot tamper with them.
- Pipeline:
  1. **Planner agent** (LLM, ≤ 4 tool steps) with the fridge inventory in its prompt and the read-only `lookup_nutrition` tool.
  2. **Schema validation** (zod). One automatic retry with the validation error.
  3. **Nutrition Verifier** (deterministic): if ≥ 70% of ingredients resolve in the nutrition DB, the macros are recomputed from the DB (`macroSource: verified|corrected`; the model's original numbers are kept in `claimed` when they drift > 25%). Otherwise `estimated`, made Atwater-consistent. Missing ingredients and `fridgeUtilization` are recomputed from the real fridge.
  4. **Safety Guard** (deterministic): vegetarian/vegan violations are hard failures → one repair round → otherwise the meal is dropped and reported in `blocked`. Low-carb/high-protein/calorie checks become user-visible `warnings`.
- Output: `{ meals: Meal[], blocked: {type, reason}[] }`.
- FR-4 Cooked meals keep their type; refresh only regenerates uncooked types.
- FR-5 Marking a meal cooked deducts matched ingredients; unchecking restores them.

### 3.3 Outside food — `POST /v1/food/analyze`
- Input text (≤ 300 chars) and/or image. Output `{name, calories, protein, carbs, fat, confidence, isFood}`, always labeled "AI estimate" in the UI.

### 3.4 Workouts — `POST /v1/workouts/suggest`
- Input `{ recentWorkouts (≤ 14), filterType? }`. Output 1–3 workouts. The guard caps difficulty (sedentary → Beginner, lightly active → Intermediate) and adds warnings.

### 3.5 Billing — Stripe Checkout (test mode)
- New accounts subscribe to a **$4.99/month** plan before using the app. Accounts that existed before payments were added are `grandfathered` (free).
- Routes (all require a signed-in user): `GET /v1/billing/status`, `GET /v1/billing/membership` (status plus renewal date from Stripe), `POST /v1/billing/checkout` (returns the Checkout URL), `POST /v1/billing/confirm` (called on return from Checkout; checks the session belongs to the user), `POST /v1/billing/cancel`, `POST /v1/billing/resume`, and the signed webhook `POST /v1/billing/webhook`.
- Status is stored in the `subscriptions` table. Users can read their own row (RLS) but not write it; only the API's billing module writes it, from Stripe-verified data.
- Every AI route returns **402** unless the status is `active`, `trialing` or `grandfathered`.
- Cancel: paid accounts cancel at the end of the paid period (and can undo it until then); grandfathered accounts lose free access immediately.

## 4. Non-functional requirements
| Area | Requirement |
|---|---|
| Security | No secrets in the client bundle. Every API route requires a valid Supabase JWT. CORS allow-list. |
| Privacy | Server reads data as the user (RLS). Logs hold metadata only (latency, tokens, flags). No training on user data. |
| Payments | Stripe test mode. Webhook signature verified. Only the billing module holds the Supabase service-role key, used only to upsert `subscriptions`. |
| Abuse | 30 AI requests / 10 min / user. 8 MB body limit, 6 MB image limit. |
| Latency | Meal plan p50 < 20 s; scan < 8 s. |
| Cost | ~1 planner run ≈ 2–3 model calls on Claude Haiku 5.5 at low effort. |
| Availability | Fly machine auto-starts on request, with a health check at `/health`. |

## 5. Evaluation and acceptance
Acceptance = the eval suite (`eval/`) passes ≥ 90% overall and 100% on diet-compliance and injection cases, plus `npm test` green. See `docs/evaluation.md`.

## 6. Milestones
| # | Deliverable | Owner |
|---|---|---|
| M1 | API on Fly with auth, meal/scan/food/workout endpoints | |
| M2 | Verifier, guard, nutrition DB + unit tests | |
| M3 | Expo web on Vercel, client switched to API | |
| M4 | Eval suite + failure log + human review | |
| M5 | Slides, demo video, reflection | |

## 7. Open questions / future work
- Move meal and workout history from device storage (AsyncStorage) to Supabase so plans sync across devices and the planner can use eating history.
- Replace the 62-item nutrition table with the USDA FoodData Central API or an embedded vector index for long-tail foods.
- Allergy field in onboarding with hard enforcement (same mechanism as vegan).
- Streaming responses to cut perceived latency.
