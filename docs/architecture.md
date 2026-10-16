# Fueli — System Architecture

```mermaid
flowchart LR
  subgraph Client["Expo app — Web on Vercel · iOS/Android"]
    UI["Screens<br/>Fridge · My Meal · Exercise · Settings · Paywall"]
    APIc["lib/api.js<br/>(Bearer = Supabase JWT)"]
    UI --> APIc
  end

  subgraph Supa["Supabase"]
    Auth["Auth<br/>(profile in user_metadata)"]
    DB[("Postgres<br/>ingredients + RLS")]
    SUBS[("subscriptions<br/>(RLS, read-only to users)")]
  end

  subgraph Fly["Fueli API — Express on Fly.io"]
    GW["Gateway<br/>JWT verify · CORS · rate limit · zod input · requirePaid"]
    BILL["Billing module<br/>(service role, subscriptions table only)"]
    subgraph Agents["Agent roles"]
      PL["Meal Planner agent<br/>(LLM + tools loop)"]
      NV["Nutrition Verifier<br/>(deterministic)"]
      SG["Safety Guard<br/>(deterministic rules)"]
      WC["Workout Coach<br/>(LLM)"]
      VI["Vision Analyzer<br/>(LLM)"]
    end
    subgraph Tools["Tools / retrieval"]
      T2["lookup_nutrition"]
      KB[("nutrition.json<br/>62 foods, per-100 g")]
    end
    LOG["Metadata logs<br/>latency · tokens · flags"]
  end

  LLM["Claude Haiku 5.5<br/>(Messages API: chat + vision, tool use)"]
  Stripe["Stripe Checkout + webhooks<br/>(test mode)"]

  UI -- "sign in / CRUD fridge (RLS)" --> Auth
  UI --> DB
  APIc -- HTTPS --> GW
  GW -- "getUser(jwt)" --> Auth
  GW --> PL & WC & VI
  GW -- "load fridge as user" --> DB
  GW -- "requirePaid (as user)" --> SUBS
  GW --> BILL
  BILL <--> Stripe
  BILL --> SUBS
  UI -. "redirect to pay" .-> Stripe
  PL -- "tool calls" --> T2
  T2 --> KB
  PL --> NV --> SG
  SG -- "violation → 1 repair round" --> PL
  WC --> SG
  VI -- "ground per-100 g values" --> T2
  PL & WC & VI <--> LLM
  GW --> LOG
```

A hand-drawn version of the same system, used in the write-up and slides:

![Fueli system graph: what runs on Vercel and Fly.io, and how the agents work together](img/architecture.png)


## Components

| Layer | What | Where |
|---|---|---|
| **UI** | Expo SDK 54 / React Native, exported as a static SPA for the web (`expo export -p web`) and hosted on Vercel. The same code runs on iOS/Android via Expo. | `App.js`, `screens/`, `vercel.json` |
| **Auth & data** | Supabase Auth (email/password; profile stored in `user_metadata`) and Postgres `ingredients` table protected by RLS. Meal/workout history currently lives in device storage. | `lib/supabase.js`, `supabase/migrations/` |
| **API gateway** | Express 5 on Fly.io: verifies the Supabase JWT, creates a per-request Supabase client *as the user*, enforces the CORS allow-list, rate limit and zod request schemas. | `server/src/index.js`, `auth.js`, `rateLimit.js` |
| **Billing** | Stripe Checkout in test mode ($4.99/month). The gateway's `requirePaid` reads the user's `subscriptions` row as the user and returns 402 when not active. `billing.js` creates Checkout sessions, confirms them on return, handles cancel/resume, and verifies webhook signatures; it is the only code holding the service-role key, used only to upsert `subscriptions`. | `server/src/billing.js`, `supabase/migrations/002_subscriptions.sql`, `screens/PaywallScreen.js`, `screens/MembershipScreen.js` |
| **Model** | Anthropic Claude Haiku 5.5 (`claude-haiku-5-5`, set by `ANTHROPIC_MODEL`) via the Messages API with tool use, low effort, and zod-validated JSON; all output in English. Swappable in one file. | `server/src/llm.js` |
| **Data / retrieval** | Local nutrition knowledge base (USDA-derived per-100 g values, aliases, piece weights) with fuzzy name matching and unit→gram conversion. | `server/src/data/nutrition.json`, `tools/nutrition.js` |
| **Context** | The planner receives a compact profile view (no height or weight, only an approximate calorie target) and the fridge inventory in its prompt. All user-controlled text is wrapped in `<user_data>` blocks with an explicit "data, not instructions" rule. | `guard.js`, `agents/mealPlanner.js` |
| **Tools** | `lookup_nutrition` (KB, read-only). The fridge inventory is loaded from Supabase server-side and included in the prompt. The model has **no write tools**; fridge changes happen only when the user taps "cooked". | `tools/` |
| **Skills (Claude Code)** | `run-evals`, `deploy-fueli`: reusable workflows used while building. | `.claude/skills/` |
| **Agent / subagent roles** | Runtime: Planner (LLM), Nutrition Verifier, Safety Guard, Workout Coach, Vision Analyzer. Dev-time Claude Code subagents: `nutrition-auditor`, `safety-reviewer`. | `server/src/agents/`, `.claude/agents/` |
| **Evaluation** | 17 cases across 3 suites, automated rubric, JSON + Markdown reports. | `eval/` |

## Meal-plan request lifecycle
1. Client → `POST /v1/meals/suggest {neededTypes}` with the user's JWT.
2. Gateway verifies the JWT, loads the fridge (≤ 80 items, soonest expiry first) under RLS, and reads the profile from auth metadata.
   - 2a. `requirePaid` reads the user's `subscriptions` row (as the user, under RLS); if the status isn't active, the request stops with 402.
3. Planner loop: the fridge is in the prompt; the model calls `lookup_nutrition([...])`, then returns final JSON (validated by zod, with one retry).
4. Verifier: macros recomputed from the KB when coverage ≥ 70%; missing ingredients and fridge utilization recomputed.
5. Guard: diet violations trigger one repair call; anything still violating is dropped and reported.
6. Response `{meals, blocked}`. One metadata log line is written.

## Why this split
- **Vercel** serves static assets from a CDN, which suits an exported Expo SPA, with preview deploys per branch.
- **Fly.io** runs a long-lived Node process. Agent loops take 10–25 s, beyond comfortable serverless limits; Fly keeps secrets server-side and scales to zero.
- **Deterministic code around the LLM:** the parts that must be correct (numbers for known foods, diet rules, state changes) are not left to the model.
