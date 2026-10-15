---
name: deploy-fueli
description: Deploy Fueli — the API to Fly.io (server/) and the Expo web app to Vercel (repo root). Use when asked to deploy, ship, release, or update the live demo.
---

# Deploy Fueli

Deploying is outward-facing: confirm with the user before running any `fly deploy` or `vercel --prod`.

## Preflight
1. `cd server && npm test` must pass. If AI code changed since the last eval, run the `run-evals` skill first.
2. `git status` — make sure no `.env` files or keys are staged. `grep -rn "sk-" lib screens App.js` must return nothing.

## API → Fly.io (from `server/`)
- First time only: `fly launch --no-deploy --copy-config` (keep `fly.toml`, pick a unique app name), then
  `fly secrets set ANTHROPIC_API_KEY=... SUPABASE_ANON_KEY=...`
- Deploy: `fly deploy`
- Verify: `curl https://<app>.fly.dev/health` → `{"ok":true,...}`
- Logs: `fly logs` — each AI call logs one JSON line (`evt: "ai"`) with latency, tokens and flags only.

## Web → Vercel (from repo root)
- First time only: `vercel link`, then set `EXPO_PUBLIC_API_URL=https://<app>.fly.dev` (and the Supabase publishable vars) for Production and Preview: `vercel env add EXPO_PUBLIC_API_URL`.
- Preview: `vercel` · Production: `vercel --prod`
- `EXPO_PUBLIC_*` vars are baked in at build time, so redeploy after changing them.

## After deploy
- Add the Vercel URL to `ALLOWED_ORIGINS` in `server/fly.toml` if it isn't covered, then `fly deploy` again.
- Smoke test in the browser: sign in → Fridge → My Meal → "Get AI Suggestions".
