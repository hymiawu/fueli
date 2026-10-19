// Expiry dates are stored as YYYY-MM-DD text (D-50). Older rows may hold other free text; those count as undated.

const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Local calendar date for a YYYY-MM-DD string, or null if it isn't one (including impossible dates).
export function parseExpiry(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || '').trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export const isValidExpiry = (text) => String(text || '').trim() === '' || parseExpiry(text) !== null;

// Whole days from today to the expiry date (negative once past), or null when undated.
export function daysUntil(text, now = new Date()) {
  const d = parseExpiry(text);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d - today) / 86400000);
}

export function addDays(n, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  return toISODate(d);
}

// The three quick chips on the Scan and edit forms.
export const EXPIRY_CHIPS = [
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 },
];

// Card wording and color (D-35): orange at 3 days or fewer, red once past, nothing when undated.
export function expiryLabel(text, now = new Date()) {
  const n = daysUntil(text, now);
  if (n === null) return null;
  if (n < 0) return { text: `Expired ${-n} day${n === -1 ? '' : 's'} ago`, tone: 'expired' };
  if (n === 0) return { text: 'Expires today', tone: 'soon' };
  return { text: `Expires in ${n} day${n === 1 ? '' : 's'}`, tone: n <= 3 ? 'soon' : 'later' };
}
