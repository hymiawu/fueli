# Reflection: Building Fueli with Claude Code

> **Draft.** The factual parts below describe what was done. Sections marked ✏️ should be rewritten in the team's own words before submission.

## How we used Claude Code
- **Re-architecture.** Claude Code read the original Expo app (≈2,400 lines across 9 screens) and found that it called OpenAI directly from the client with a hardcoded key. It proposed splitting it into an Expo web client on Vercel and an agent API on Fly.io, then did the migration while keeping the screens' existing behavior.
- **Eval-driven iteration.** We had Claude Code write the eval suite *before* tuning prompts. The first full run scored **14/17**, and the failures exposed two real bugs (see `docs/evaluation.md` → Failure log):
  1. the Nutrition Verifier kept the model's internally inconsistent macros when its calorie claim happened to be close;
  2. an empty fridge produced a meal with no ingredients and 0 kcal, which the schema accepted.
  Both were fixed in deterministic code and schema, not by prompt tweaking, and the meal suite went to 8/8.
- **Tooling problems handled.** `expo install` and `expo export` hung on network calls in the agent's sandbox. Claude Code read the pinned SDK 54 versions from `expo/bundledNativeModules.json`, installed them with npm instead, and ran the export with `EXPO_OFFLINE=1`.

## Reusable Skills we created (`.claude/skills/`)
| Skill | What it encodes | Why it's reusable |
|---|---|---|
| `run-evals` | Unit tests → eval suite → classify each failure as prompt / schema / deterministic code / bad expectation → re-run → log before/after | Any teammate (or Claude) runs the same quality gate after touching AI code, with a consistent failure taxonomy |
| `deploy-fueli` | Preflight (tests, secret scan) → Fly deploy → Vercel deploy → CORS update → smoke test, with an explicit "confirm before deploying" rule | Two-platform deploys were the easiest step to get wrong |

## Specialist subagents (`.claude/agents/`)
| Subagent | Role | Tools |
|---|---|---|
| `nutrition-auditor` | Reviews eval outputs and `nutrition.json` for implausible numbers. Reports only, never edits. | Read, Grep, Glob, Bash |
| `safety-reviewer` | Red-teams for secrets, prompt injection, data leakage and unsafe advice. Proposes new adversarial eval cases. | Read, Grep, Glob, Bash |

These are read-only by design: they produce findings, and a human (or the main session) decides what to change.

## What worked well ✏️
- *e.g. Writing the rubric first kept us honest; the eval caught bugs we would have demoed.*
- *e.g. Asking Claude to put "must be correct" logic in deterministic code rather than prompts.*

## What didn't ✏️
- *e.g. Model outputs vary run to run; one passing eval isn't proof. We started running flaky cases 3×.*
- *e.g. Claude's first verifier version was too trusting; it took the eval to show it.*

## What we'd do differently ✏️
- *e.g. Move meal history to Supabase earlier so the planner could use eating history.*
- *e.g. Add a CI job that runs `npm test` on every push and the eval suite nightly.*

## Division of work ✏️
| Teammate | Contributions |
|---|---|
| | |
