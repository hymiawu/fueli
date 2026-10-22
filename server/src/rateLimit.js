// Small in-memory sliding window per user. Fine for one Fly machine; use Redis/Upstash if you scale out.
import { PRICE_LABEL } from './price.js';
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

// Daily caps per user and route family (handoff 6.5, D-49): what one user can cost us in a day.
// In memory like the limiter above, so a restart resets the counts; Redis would replace this at scale.
// Counters reset at midnight UTC.
export const DAILY_FAMILIES = {
  meals: { limit: () => Number(process.env.DAILY_MEALS || 20), noun: 'meal plans' },
  workouts: { limit: () => Number(process.env.DAILY_WORKOUTS || 10), noun: 'workout requests' },
  scans: { limit: () => Number(process.env.DAILY_SCANS || 50), noun: 'scans and food estimates' },
};
const daily = new Map(); // `${userId}|${family}` -> { day, count }
const utcDay = (now) => new Date(now).toISOString().slice(0, 10);

// Takes one unit of the user's daily allowance. Returns null when allowed, or the 429 message.
export function takeDaily(userId, family, now = Date.now()) {
  const f = DAILY_FAMILIES[family];
  if (!f) return null;
  const key = `${userId}|${family}`;
  const day = utcDay(now);
  const entry = daily.get(key);
  const count = entry?.day === day ? entry.count : 0;
  if (count >= f.limit()) return `Daily limit reached: ${f.limit()} ${f.noun} a day on the ${PRICE_LABEL} plan. Resets at midnight UTC.`;
  daily.set(key, { day, count: count + 1 });
  return null;
}

// Gives the unit back, for requests that failed on our side.
export function refundDaily(userId, family, now = Date.now()) {
  const entry = daily.get(`${userId}|${family}`);
  if (entry?.day === utcDay(now) && entry.count > 0) entry.count -= 1;
}

// Remaining allowance per family, for the Membership screen.
export function dailyUsage(userId, now = Date.now()) {
  const day = utcDay(now);
  return Object.fromEntries(Object.entries(DAILY_FAMILIES).map(([family, f]) => {
    const entry = daily.get(`${userId}|${family}`);
    const used = entry?.day === day ? entry.count : 0;
    return [family, { used, limit: f.limit() }];
  }));
}
