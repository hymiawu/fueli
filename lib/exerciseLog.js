// Reps and weight per exercise, on the device per account (handoff 6.3.5). Weight is always stored in kg.
export const KG_PER_LB = 0.4536;
export const MAX_SESSIONS = 5;

// log: { [exerciseId]: [ { date, sets: [ { reps, weightKg } ] } ] }, newest first.
export function addSession(log, exerciseId, session) {
  const sessions = [session, ...(log[exerciseId] || []).filter((s) => s.date !== session.date)].slice(0, MAX_SESSIONS);
  return { ...log, [exerciseId]: sessions };
}

const fmtWeight = (kg, units) => {
  const v = units === 'imperial' ? kg / KG_PER_LB : kg;
  return `${Math.round(v * 10) / 10} ${units === 'imperial' ? 'lb' : 'kg'}`;
};
// Weight 0 means no added weight (Pushups, Pullups), so it reads as bodyweight, not "0 kg".
const at = (kg, units) => (kg > 0 ? `@ ${fmtWeight(kg, units)}` : '(bodyweight)');

// "3 × 10 @ 12 kg", "10, 10, 8 @ 12 kg", "3 × 10 (bodyweight)", or "10 @ 12 kg, 8 @ 10 kg" when the weights differ.
export function lastTimeText(sessions, units = 'metric') {
  const last = sessions?.[0];
  if (!last?.sets?.length) return null;
  const sets = last.sets;
  const sameWeight = sets.every((s) => s.weightKg === sets[0].weightKg);
  const sameReps = sets.every((s) => s.reps === sets[0].reps);
  if (sameWeight && sameReps) return `Last time: ${sets.length} × ${sets[0].reps} ${at(sets[0].weightKg, units)}`;
  if (sameWeight) return `Last time: ${sets.map((s) => s.reps).join(', ')} ${at(sets[0].weightKg, units)}`;
  return `Last time: ${sets.map((s) => `${s.reps} ${at(s.weightKg, units)}`).join(', ')}`;
}

// First number in the plan's reps ("8-10" -> 8), and the set count ("3" or "3 sets" -> 3).
export const firstNumber = (v, fallback) => {
  const m = /\d+/.exec(String(v ?? ''));
  return m ? Number(m[0]) : fallback;
};
