// Builds src/data/exercises.json, the static exercise library for the workout coach (handoff 6.3.4).
// Source: free-exercise-db (public domain, Unlicense), https://github.com/yuhonas/free-exercise-db
// Run once from server/: node scripts/build-exercises.mjs. Commit the output; the API never fetches it at runtime.
import { writeFileSync } from 'node:fs';

const SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// Ids as the dataset spells them. Mostly beginner, some intermediate, and two expert
// (Handstand_Push-Ups, Clean_and_Jerk) so the level cap has something to remove.
const IDS = {
  'Chest and arms': ['Pushups', 'Incline_Push-Up', 'Dumbbell_Bench_Press', 'Barbell_Bench_Press_-_Medium_Grip', 'Dips_-_Triceps_Version', 'Dumbbell_Bicep_Curl', 'Hammer_Curls', 'Triceps_Pushdown'],
  Back: ['Pullups', 'Chin-Up', 'Muscle_Up', 'Wide-Grip_Lat_Pulldown', 'Seated_Cable_Rows', 'Bent_Over_Two-Dumbbell_Row', 'One-Arm_Dumbbell_Row', 'Face_Pull', 'Superman'],
  Shoulders: ['Standing_Military_Press', 'Dumbbell_Shoulder_Press', 'Side_Lateral_Raise', 'Handstand_Push-Ups', 'Clean_and_Jerk'],
  'Legs and glutes': ['Bodyweight_Squat', 'Barbell_Squat', 'Goblet_Squat', 'Leg_Press', 'Dumbbell_Lunges', 'Dumbbell_Step_Ups', 'Barbell_Deadlift', 'Romanian_Deadlift', 'Butt_Lift_Bridge', 'Single_Leg_Glute_Bridge', 'Standing_Calf_Raises', 'Barbell_Hip_Thrust', 'Freehand_Jump_Squat'],
  Core: ['Plank', 'Crunches', '3_4_Sit-Up', 'Russian_Twist', 'Dumbbell_Side_Bend', 'Air_Bike', 'Oblique_Crunches_-_On_The_Floor', 'Dead_Bug'],
  'Cardio and HIIT': ['Mountain_Climbers', 'Rope_Jumping', 'Walking_Treadmill', 'Jogging_Treadmill', 'Bicycling_Stationary', 'Rowing_Stationary', 'Elliptical_Trainer', 'Box_Jump_Multiple_Response'],
  Flexibility: ['Hamstring_Stretch', 'Cat_Stretch', 'Upward_Stretch', 'Kneeling_Hip_Flexor', 'Childs_Pose', 'Spinal_Stretch'],
};

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const byId = new Map((await res.json()).map((e) => [e.id, e]));

const exercises = Object.entries(IDS).flatMap(([group, ids]) =>
  ids.map((id) => {
    const e = byId.get(id);
    if (!e) throw new Error(`Not in the dataset: ${id}`);
    return {
      id: e.id,
      name: e.name,
      group,
      level: e.level,
      category: e.category,
      equipment: e.equipment ?? 'none',
      primaryMuscles: e.primaryMuscles,
      secondaryMuscles: e.secondaryMuscles,
      instructions: e.instructions,
      // Copied verbatim: some image folders do not match the id (a rebuilt path 404s).
      images: e.images.map((p) => IMAGE_BASE + p),
    };
  }),
);

const out = new URL('../src/data/exercises.json', import.meta.url);
writeFileSync(out, JSON.stringify({ source: 'free-exercise-db (public domain, Unlicense)', exercises }, null, 1) + '\n');
console.log(`Wrote ${exercises.length} exercises to src/data/exercises.json`);
