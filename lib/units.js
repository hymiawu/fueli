// Height and weight are always stored in metric, as strings ("175", "72.6"), because the server's
// calorie target reads Number(weight) in kg. Imperial is only an input and display choice (handoff 6.4).
const CM_PER_IN = 2.54;
const KG_PER_LB = 0.4536;

const num = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

// Returns { height, weight } as metric strings, or { error } with a plain message.
export function toMetric({ units, heightCm, weightKg, feet, inches, pounds }) {
  let cm;
  let kg;
  if (units === 'imperial') {
    const ft = num(feet);
    const inch = String(inches ?? '').trim() === '' ? 0 : num(inches);
    cm = Math.round((ft * 12 + inch) * CM_PER_IN);
    kg = Math.round(num(pounds) * KG_PER_LB * 10) / 10;
  } else {
    cm = Math.round(num(heightCm));
    kg = Math.round(num(weightKg) * 10) / 10;
  }
  if (!Number.isFinite(cm) || cm < 100 || cm > 250) {
    return { error: units === 'imperial' ? 'Height must be between 3 ft 4 in and 8 ft 2 in.' : 'Height must be between 100 and 250 cm.' };
  }
  if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
    return { error: units === 'imperial' ? 'Weight must be between 66 and 661 lb.' : 'Weight must be between 30 and 300 kg.' };
  }
  return { height: String(cm), weight: String(kg) };
}

// Stored metric strings -> imperial input strings, for reopening Edit Profile in imperial.
export function toImperial(height, weight) {
  const cm = num(height);
  const kg = num(weight);
  const out = { feet: '', inches: '', pounds: '' };
  if (Number.isFinite(cm) && cm > 0) {
    const totalIn = Math.round(cm / CM_PER_IN);
    out.feet = String(Math.floor(totalIn / 12));
    out.inches = String(totalIn % 12);
  }
  if (Number.isFinite(kg) && kg > 0) out.pounds = String(Math.round(kg / KG_PER_LB));
  return out;
}
