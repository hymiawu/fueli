# Fueli — Product Brief

## Target user
Students and young professionals (18–30) who are trying to eat better and train consistently, but who:
- cook for themselves on a budget, with whatever happens to be in the fridge,
- don't want to log every gram of food by hand,
- have a concrete goal (lose fat, build muscle, maintain) and sometimes a diet constraint (vegetarian, vegan, low-carb, high-protein).

## The problem
1. **"What do I cook with what I have?"** Recipe apps start from recipes, not from your fridge, so food expires and people order takeout.
2. **Nutrition tracking is tedious and error-prone.** Manual logging has high drop-off. Pure LLM estimates feel convenient but hallucinate numbers that look precise.
3. **Food and training are planned in separate apps,** so neither knows about your goal or what you did yesterday.

## Proposed workflow
1. **Stock the fridge** — snap a photo (vision model identifies the item and grounds its nutrition in a food database) or add it manually.
2. **Get a day of meals** — a planner agent reads the fridge, looks up nutrition data, and drafts breakfast/lunch/dinner that use what's expiring first. A verifier recomputes macros from the database and a safety guard enforces the user's diet before anything is shown.
3. **Cook and check off** — marking a meal as cooked deducts the ingredients from the fridge (and restores them if unchecked). A "Plan" toggle turns missing ingredients into a shopping list.
4. **Log eating out** — describe or photograph restaurant food for a clearly labeled AI estimate.
5. **Train** — a workout coach suggests three sessions that match the goal and activity level and avoid muscle groups trained recently.

## Value proposition
**Fueli turns the food you already have into a goal-aligned day of meals and workouts, with nutrition numbers you can trust.**

- *Less waste, less effort:* plans start from your fridge, not a recipe catalogue.
- *Trustworthy numbers:* macros are checked against a nutrition database rather than taken from the model's word, and the app shows which numbers were verified.
- *Respects constraints:* diet rules are enforced in code, not just requested in a prompt.
- *One loop:* fridge → meals → cooking → workouts share the same profile and history.

## Why AI (and where not)
| Task | Approach | Why |
|---|---|---|
| Identify an ingredient from a photo | Vision LLM | Open-ended recognition |
| Compose meals from arbitrary leftovers | LLM agent + tools | Creative composition under constraints |
| Calories and macros for known foods | **Database lookup** (retrieval) | Facts should not be generated |
| Diet compliance, difficulty limits | **Deterministic rules** | Must never fail silently |
| Fridge deduction on "cooked" | **Deterministic code** | State changes need a human action |

## Success metrics (for the capstone)
| Metric | Target | Measured (Claude Haiku 5.5, 2026-10-16) |
|---|---|---|
| Eval cases passing (see `docs/evaluation.md`) | ≥ 90% | 17/17 (100%) |
| Diet compliance on vegetarian/vegan cases | 100% | 3/3 cases, 100% |
| Meal ingredients from the user's fridge | ≥ 50% on average | 92% across 15 meals |
| p50 meal-plan latency | < 20 s | 8.5 s |
