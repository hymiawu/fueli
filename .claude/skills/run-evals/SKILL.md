---
name: run-evals
description: Run Fueli's AI evaluation suite (meal planner, outside-food analyzer, workout coach), summarize pass/fail by rubric check, and propose fixes for failures. Use after changing any prompt, schema, agent, verifier or guard in server/src, or when asked to "run evals" / "check AI quality".
---

# Run Fueli evals

1. Make sure `server/.env` has `ANTHROPIC_API_KEY`. If not, stop and ask — never print or commit the key.
2. Run the deterministic tests first (free, fast): `cd server && npm test`. Fix failures before spending tokens.
3. Run the suite: `cd server && npm run eval` (or `npm run eval -- --only meals|food|workouts` for one suite).
4. Read `eval/results/latest.md`. For each failed case:
   - Name the failing rubric check (see `eval/rubric.md`).
   - Look at the output JSON and decide whether the bug is in the **prompt** (`server/src/agents/*.js` SYSTEM strings), the **schema** (`server/src/schemas.js`), the **verifier/guard** (deterministic code), or the **eval itself** (a wrong expectation).
   - Prefer fixing deterministic code over prompt wording when both would work: it is testable and doesn't drift.
5. After a fix, add a unit test in `server/test/` if the fix was deterministic, then re-run only the affected suite.
6. Report: before → after pass counts, what changed, and any case that is still failing and why. Copy notable before/after examples into `docs/evaluation.md` under "Failure log".

LLM output varies run to run. Run a failing case 2–3 times before calling a fix done, and say so if a pass is flaky.
