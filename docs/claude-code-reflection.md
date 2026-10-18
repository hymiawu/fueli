# Reflection: Building Fueli with Claude Code

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

## What worked well
- Writing the eval suite before tuning prompts kept us honest. The first run scored 14/17, and both real bugs it exposed (inconsistent macros, an empty meal from an empty fridge) would otherwise have reached the demo.
- Putting anything that must be correct in deterministic code instead of the prompt. The verifier and the diet guard did not need to change when we switched models twice.
- Keeping every model call in one file. Moving from OpenAI to Claude touched `server/src/llm.js` and the image format, and nothing else.
- Small pull requests with a Vercel preview each. A broken build was caught in a preview, not on the live site: the first Vercel project pointed at `server/` instead of the repo root.

## What didn't
- One passing run is not proof. A workout rule that passed on one run failed on the next after the switch to Claude Haiku 5.5 (W2), so we now re-run a fixed case three times before calling it done.
- The first verifier was too trusting: it kept the model's macros whenever the calories looked plausible. It took the eval's failure log to show it.
- Our first eval check for prompt injection was too lenient. It passed while the model was copying the example JSON from our own prompt.
- Claude Opus 5.5 was too slow for an interactive app (about 47 s per meal plan). We traded down to Claude Haiku 5.5 at low effort, which brought it to about 15 s.
- Tooling in the sandbox: `expo export` hung on network calls until we ran it with `EXPO_OFFLINE=1`.

## What we'd do differently
- Move meal and workout history to Supabase from the start. Storing it on the device caused a bug where a second account on the same browser saw the first account's plans.
- Add a CI job that runs `npm test` on every push and the eval suite before each deploy.
- Build a labeled photo set early so the vision features have their own eval cases.

## Division of work
| Teammate | Contributions |
|---|---|
| Rou Sun | [What they did] |
| Hsinyen Wu | [What they did] |
| Yiuhon (Jeremy) Lee | [What they did] |
| Thanapol (Neil) Doungsaeng | [What they did] |
| Emmet Andrews | [What they did] |
