// Small in-memory sliding window per user. Fine for one Fly machine; use Redis/Upstash if you scale out.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = Number(process.env.AI_RATE_LIMIT || 30);
const hits = new Map();

export function rateLimit(req, res, next) {
  const key = req.user?.id || req.ip;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return res.status(429).json({ error: 'Too many AI requests — try again in a few minutes.' });
  recent.push(now);
  hits.set(key, recent);
  next();
}
