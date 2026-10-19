import { z } from 'zod';

const num = z.coerce.number().finite();
const nonNeg = num.min(0);

export const IngredientScan = z.object({
  name: z.string().min(1).max(60),
  quantity: nonNeg.default(1),
  unit: z.enum(['g', 'ml', 'piece', 'cup', 'tbsp']).catch('piece'),
  category: z.enum(['Produce', 'Protein', 'Dairy', 'Grains', 'Beverages', 'Condiments', 'Other']).catch('Other'),
  calories: nonNeg.max(1000),
  protein: nonNeg.max(100),
  carbs: nonNeg.max(100),
  fat: nonNeg.max(100),
  isFood: z.boolean().default(true),
  // From the package label when one is visible (handoff 6.1.1). A bad value is dropped, never fails the scan.
  servingSize: z.coerce.number().finite().min(1).max(2000).optional().catch(undefined),
  servingsPerContainer: z.coerce.number().finite().min(0.1).max(100).optional().catch(undefined),
});

export const OutsideFood = z.object({
  name: z.string().min(1).max(80),
  calories: nonNeg.max(5000),
  protein: nonNeg.max(400),
  carbs: nonNeg.max(800),
  fat: nonNeg.max(400),
  confidence: z.enum(['low', 'medium', 'high']).catch('medium'),
  isFood: z.boolean().default(true),
});

export const Meal = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['Breakfast', 'Lunch', 'Dinner']),
  ingredients: z.array(z.string().max(120)).max(30),
  structuredIngredients: z
    .array(z.object({ name: z.string().max(60), quantity: nonNeg, unit: z.string().max(10) }))
    .min(1)
    .max(30),
  recipe: z.string().min(1).max(3000),
  calories: num.min(50).max(3000),
  protein: nonNeg.max(300),
  carbs: nonNeg.max(500),
  fat: nonNeg.max(300),
  prepTime: z.string().max(30).default('—'),
  missingIngredients: z.array(z.string().max(120)).max(30).default([]),
});
export const MealPlan = z.object({ meals: z.array(Meal).min(1).max(3) });

export const Workout = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['Strength', 'Cardio', 'HIIT', 'Flexibility']),
  duration: z.string().max(30),
  caloriesBurned: nonNeg.max(2000),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).catch('Intermediate'),
  muscleGroups: z.array(z.string().max(30)).max(10).default([]),
  description: z.string().max(600).default(''),
  warmup: z.string().max(400).optional(),
  cooldown: z.string().max(400).optional(),
  exercises: z.array(z.record(z.any())).min(1).max(15),
});
export const WorkoutPlan = z.object({ workouts: z.array(Workout).min(1).max(3) });

// Request bodies
export const MealRequest = z.object({
  neededTypes: z.array(z.enum(['Breakfast', 'Lunch', 'Dinner'])).min(1).max(3).default(['Breakfast', 'Lunch', 'Dinner']),
  servings: z.number().int().min(1).max(8).default(1),
});
export const WorkoutRequest = z.object({
  filterType: z.enum(['Strength', 'Cardio', 'HIIT', 'Flexibility']).nullable().optional(),
  recentWorkouts: z
    .array(z.object({ date: z.string().max(10), name: z.string().max(100), type: z.string().max(20) }))
    .max(14)
    .default([]),
});
export const ScanRequest = z.object({ image: z.string().min(100) });
export const OutsideRequest = z.object({ text: z.string().max(300).optional(), image: z.string().optional() });
export const CheckoutConfirm = z.object({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/) });
