// Client for the Fueli API on Fly.io. All AI calls go through the server so no model keys ship in the app.
import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');

// expo-image-picker on web may return only a data: URI.
export const assetBase64 = (asset) => asset?.base64 || asset?.uri?.split(',')[1] || null;

async function request(method, path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

const post = (path, body) => request('POST', path, body);

// Subscription (Stripe Checkout). The server decides whether the account is paid.
export const getBillingStatus = () => request('GET', '/v1/billing/status');
export const startCheckout = () => post('/v1/billing/checkout', {});
export const confirmCheckout = (sessionId) => post('/v1/billing/confirm', { sessionId });
export const getMembership = () => request('GET', '/v1/billing/membership');
export const cancelMembership = () => post('/v1/billing/cancel', {});
export const resumeMembership = () => post('/v1/billing/resume', {});

export async function analyzeIngredientImage(base64Image) {
  return post('/v1/ingredients/scan', { image: base64Image });
}

// The server reads the fridge and profile itself, so only the meal types, servings and mode are sent.
// `today` is the local date, so "expires within 3 days" uses the user's calendar.
// `exclude` lists recipe-library ids already on screen, so Refresh brings different recipes.
export async function getMealSuggestions(neededTypes = ['Breakfast', 'Lunch', 'Dinner'], servings = 1, mode = 'hungry', exclude = []) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return post('/v1/meals/suggest', { neededTypes, servings, mode, today, exclude });
}

export async function analyzeOutsideFood(text, base64Image) {
  return post('/v1/food/analyze', { text: text || undefined, image: base64Image || undefined });
}

// todayFocus comes from the weekly plan, when there is one (6.3.3).
export async function getWorkoutSuggestions(recentWorkouts = [], filterType = null, todayFocus = undefined, yesterdayFocus = undefined, tomorrowFocus = undefined) {
  const recent = recentWorkouts.slice(0, 7).map(({ date, name, type }) => ({ date, name, type }));
  const { workouts } = await post('/v1/workouts/suggest', { recentWorkouts: recent, filterType, todayFocus, yesterdayFocus, tomorrowFocus });
  return workouts;
}

// A 7-day plan written by the AI and checked against training rules on the server (6.3.3).
export const planMyWeek = (daysPerWeek) => post('/v1/workouts/plan', { daysPerWeek });
