// Weekly plan checker (handoff 6.3.3, Neil; D-46). Plain code, no model: the AI writes the week, this decides
// whether it is safe to show, and fallbackPlan is the fixed table used when one repair is not enough.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const FOCUSES = ['Full Body', 'Upper', 'Push', 'Pull', 'Lower', 'Cardio', 'Flexibility', 'Rest'];

const PUSH = ['chest', 'shoulders', 'triceps'];
const PULL = ['back', 'biceps'];
const LOWER = ['quads', 'hamstrings', 'glutes', 'calves'];
export const MUSCLES = {
  Push: PUSH,
  Pull: PULL,
  Lower: LOWER,
  Upper: [...PUSH, ...PULL],
  'Full Body': [...PUSH, ...PULL, ...LOWER],
  Cardio: [],
  Flexibility: [],
  Rest: [],
};
const SPLITS = ['Upper', 'Push', 'Pull', 'Lower'];
const isLowActivity = (profile) => ['sedentary', 'lightly active'].includes(String(profile?.activity || '').toLowerCase());
const isLoseFat = (profile) => String(profile?.goal || '').toLowerCase() === 'lose fat';

// Returns a list of problems in plain words; empty means the plan passes.
export function checkWeekPlan(plan, profile, daysPerWeek) {
  const days = plan?.days || [];
  const problems = [];
  if (days.length !== 7 || DAYS.some((d, i) => days[i]?.day !== d)) return ['The plan must list Mon to Sun in order, one entry each.'];
  const training = days.filter((d) => d.focus !== 'Rest');
  const rest = days.length - training.length;
  if (training.length !== daysPerWeek) problems.push(`Use exactly ${daysPerWeek} training days (found ${training.length}).`);
  if (rest < 2) problems.push(`Keep at least 2 Rest days (found ${rest}).`);
  for (let i = 0; i < 7; i++) {
    const a = days[i];
    const b = days[(i + 1) % 7]; // Sun -> Mon counts too
    const shared = (MUSCLES[a.focus] || []).filter((m) => (MUSCLES[b.focus] || []).includes(m));
    if (shared.length) problems.push(`${a.day} (${a.focus}) and ${b.day} (${b.focus}) both train ${shared.join(', ')}.`);
  }
  if (isLoseFat(profile) && !days.some((d) => d.focus === 'Cardio')) problems.push('Lose Fat needs at least one Cardio day.');
  if (isLowActivity(profile)) {
    const splits = days.filter((d) => SPLITS.includes(d.focus));
    if (splits.length) problems.push(`Use Full Body instead of ${[...new Set(splits.map((d) => d.focus))].join(', ')} for this activity level.`);
  }
  return problems;
}

// Fixed weeks, generalized from Neil's app. Sedentary and Lightly Active get Full Body rows for every goal (D-46).
const DEFAULT = {
  2: { Mon: 'Full Body', Thu: 'Full Body' },
  3: { Mon: 'Full Body', Wed: 'Full Body', Fri: 'Full Body' },
  4: { Mon: 'Upper', Tue: 'Lower', Thu: 'Upper', Fri: 'Lower' },
  5: { Mon: 'Upper', Tue: 'Lower', Wed: 'Cardio', Thu: 'Upper', Fri: 'Lower' },
};
const LOSE_FAT = {
  2: { Mon: 'Full Body', Thu: 'Cardio' },
  3: { Mon: 'Full Body', Wed: 'Cardio', Fri: 'Full Body' },
  4: { Mon: 'Upper', Tue: 'Lower', Thu: 'Cardio', Sat: 'Full Body' },
  5: DEFAULT[5],
};
const LOW_DEFAULT = {
  2: { Mon: 'Full Body', Thu: 'Full Body' },
  3: { Mon: 'Full Body', Wed: 'Full Body', Fri: 'Full Body' },
  4: { Mon: 'Full Body', Tue: 'Cardio', Wed: 'Full Body', Fri: 'Full Body' },
  5: { Mon: 'Full Body', Tue: 'Cardio', Wed: 'Full Body', Fri: 'Full Body', Sat: 'Flexibility' },
};
const LOW_LOSE_FAT = { ...LOW_DEFAULT, 2: { Mon: 'Full Body', Thu: 'Cardio' }, 3: { Mon: 'Full Body', Wed: 'Cardio', Fri: 'Full Body' } };

const NOTES = {
  'Full Body': 'Trains every major muscle once, with a day to recover after.',
  Upper: 'Chest, back, shoulders and arms.',
  Lower: 'Legs and glutes.',
  Cardio: 'Heart and lungs; burns energy without loading the muscles you trained.',
  Flexibility: 'Light mobility to help recovery.',
  Rest: 'Recovery day.',
};

export function fallbackPlan(profile, daysPerWeek) {
  const n = Math.min(5, Math.max(2, daysPerWeek));
  const table = isLowActivity(profile) ? (isLoseFat(profile) ? LOW_LOSE_FAT : LOW_DEFAULT) : isLoseFat(profile) ? LOSE_FAT : DEFAULT;
  const row = table[n];
  return {
    summary: `A ${n}-day week from Fueli's training rules.`,
    days: DAYS.map((day) => ({ day, focus: row[day] || 'Rest', note: NOTES[row[day] || 'Rest'] })),
  };
}
