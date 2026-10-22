import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// A token Supabase has verified is remembered for 60 s, so a burst of requests checks it once. Supabase's auth
// service was taking 16-80 s at times (Oct 22). The trade-offs: a signed-out token keeps working for up to 60 s,
// and a profile change reaches the planner up to 60 s later. Database reads still go through RLS with the token.
const VERIFIED_TTL_MS = 60 * 1000;
const MAX_CACHED = 1000;
const verified = new Map(); // token -> { user, until }

export function cachedUser(token, now = Date.now()) {
  const hit = verified.get(token);
  if (hit && hit.until > now) return hit.user;
  if (hit) verified.delete(token);
  return null;
}

export function rememberUser(token, user, now = Date.now()) {
  if (verified.size >= MAX_CACHED) verified.delete(verified.keys().next().value); // drop the oldest
  verified.set(token, { user, until: now + VERIFIED_TTL_MS });
}

// Verify the Supabase access token and give the request a client that acts *as the user*,
// so Row Level Security still applies. (Only billing.js uses a service-role key, to write subscription rows.)
export async function requireUser(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let user = cachedUser(token);
  if (!user) {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Session expired' });
    user = data.user;
    rememberUser(token, user);
  }
  req.user = user;
  req.db = db;
  next();
}

const FRIDGE_COLUMNS = 'name, quantity, unit, category, expiry';

export async function loadFridge(req) {
  const query = (columns) => req.db
    .from('ingredients')
    .select(columns)
    .eq('user_id', req.user.id)
    .order('expiry', { ascending: true, nullsFirst: false })
    .limit(80);
  let { data, error } = await query(`${FRIDGE_COLUMNS}, allergens`);
  // 42703: the allergens column (migration 003) isn't there yet. Plan without it rather than failing.
  if (error?.code === '42703') ({ data, error } = await query(FRIDGE_COLUMNS));
  if (error) throw Object.assign(new Error('Could not read fridge'), { status: 502 });
  return data || [];
}
