# Fueli

AI meal and workout planner that cooks from **your fridge**: snap ingredients, get a goal-aligned day of meals with database-verified macros, and get workouts matched to your level.

**Live demo:** https://fueli.vercel.app. On a desktop browser the app is shown inside a phone frame, since the UI is designed for phones.

- **Web app:** Expo (React Native Web) → Vercel
- **API / agents:** Node + Express → Fly.io
- **Auth & data:** Supabase (RLS)

| Capstone deliverable | Location |
|---|---|
| Write-up (4–5 pages) | [docs/write-up.md](docs/write-up.md), [docs/write-up.pdf](docs/write-up.pdf) |
| Product brief | [docs/product-brief.md](docs/product-brief.md) |
| Demo-day checklist | [docs/demo-day.md](docs/demo-day.md) |
| PRD | [docs/PRD.md](docs/PRD.md) |
| Architecture diagram | [docs/architecture.md](docs/architecture.md) |
| Evaluation package (rubric, cases, results, failure log) | [docs/evaluation.md](docs/evaluation.md), [eval/](eval/) |
| Responsible-deployment notes | [docs/responsible-ai.md](docs/responsible-ai.md) |
| Claude Code reflection, Skills, subagents | [docs/claude-code-reflection.md](docs/claude-code-reflection.md), [.claude/skills/](.claude/skills/), [.claude/agents/](.claude/agents/) |

## Repo layout
```
App.js, screens/, lib/      Expo client (lib/api.js calls the Fly API)
server/                     Fly.io API: agents, tools, guardrails, nutrition KB
eval/                       Eval cases, rubric, runner, results
supabase/migrations/        RLS policies
docs/                       Capstone documents
.claude/                    Claude Code Skills and subagents
```

## Run locally
```bash
# 1. API
cd server
cp .env.example .env              # fill ANTHROPIC_API_KEY and SUPABASE_ANON_KEY
npm install
npm test                          # deterministic tests, no API key needed
npm run dev                       # http://localhost:8080/health

# 2. App (repo root, another terminal)
cp .env.example .env.local        # EXPO_PUBLIC_API_URL=http://localhost:8080
npm install
npm run web                       # or: npm run ios / npm run android
```
On a physical phone, set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (e.g. `http://192.168.1.20:8080`) or to the Fly URL.

## Evaluate
```bash
cd server && npm run eval          # writes eval/results/latest.md
```

## Deploy
**API → Fly.io** (from `server/`)
```bash
fly launch --no-deploy --copy-config   # first time; pick a unique app name and update fly.toml
fly secrets set ANTHROPIC_API_KEY=sk-ant-... SUPABASE_ANON_KEY=sb_publishable_...
fly deploy
curl https://<app>.fly.dev/health
```

**Web → Vercel** (from repo root)

In the Vercel project settings (Build and Deployment), leave **Root Directory** empty (the repo root) and set **Framework Preset** to **Other**. Vercel may pick `server/` as an Express app on import, which breaks the build with `expo: command not found`. Build and output settings come from [vercel.json](vercel.json).
```bash
vercel link
vercel env add EXPO_PUBLIC_API_URL            # https://<app>.fly.dev  (Production + Preview)
vercel env add EXPO_PUBLIC_SUPABASE_URL
vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY
vercel --prod
```
If the repo is connected to Vercel on GitHub, pushing to `main` deploys to production and each pull request gets a preview URL. `EXPO_PUBLIC_*` values are built into the app, so redeploy after changing them.
Then make sure the Vercel domain is listed in `ALLOWED_ORIGINS` in `server/fly.toml`, and redeploy the API if you changed it.

**Supabase:** run `supabase/migrations/000_ingredients.sql`, `001_ingredients_rls.sql` and `002_subscriptions.sql`, in that order, in the SQL editor once. The second one creates the subscription table and marks accounts that already exist as `grandfathered` (free).

**Payments → Stripe (test mode).** New accounts must subscribe ($4.99/month) before using the app; the API refuses AI requests from unpaid accounts (HTTP 402).
1. In the Stripe Dashboard with **Test mode** on, copy the secret key (`sk_test_...`).
2. Developers → Webhooks → Add endpoint: `https://<app>.fly.dev/v1/billing/webhook`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its signing secret (`whsec_...`).
3. Supabase → Project Settings → API Keys → copy the **secret / service_role** key. Only the API's billing module uses it, to write subscription status.
4. `fly secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... SUPABASE_SERVICE_ROLE_KEY=...` and `fly deploy`.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## License
MIT. See [LICENSE](LICENSE).
