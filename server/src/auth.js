import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Verify the Supabase access token and give the request a client that acts *as the user*,
// so Row Level Security still applies. The server never holds a service-role key.
export async function requireUser(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Session expired' });
  req.user = data.user;
  req.db = db;
  next();
}

export async function loadFridge(req) {
  const { data, error } = await req.db
    .from('ingredients')
    .select('name, quantity, unit, category, expiry')
    .eq('user_id', req.user.id)
    .order('expiry', { ascending: true, nullsFirst: false })
    .limit(80);
  if (error) throw Object.assign(new Error('Could not read fridge'), { status: 502 });
  return data || [];
}
