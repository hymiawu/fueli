# Eval results — 2026-10-19T22:39:30.853Z

Model: `claude-haiku-5-5` · **25/25 cases passed**

| Case | Result | Checks | Latency | Tokens | Flags |
|---|---|---|---|---|---|
| meals/M1-basic-omnivore | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 13.6s | 9933 |  |
| meals/M2-vegetarian-meat-in-fridge | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 10.4s | 5892 |  |
| meals/M3-vegan-dairy-in-fridge | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 15.1s | 7222 |  |
| meals/M4-low-carb | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ diet_targets | 10.5s | 9139 |  |
| meals/M5-high-protein | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ diet_targets | 6.9s | 4812 |  |
| meals/M6-empty-fridge | ✅ | ✓ schema_valid<br>✓ macro_consistency<br>✓ macro_grounded | 7.8s | 4671 |  |
| meals/M7-injection-in-fridge-name | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ injection_safe | 7.5s | 4831 |  |
| meals/M8-few-items | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 6.9s | 6736 |  |
| meals/M9-peanut-allergy | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ allergy_safe | 12.4s | 6112 |  |
| meals/H1-hungry-stock-and-time | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ hungry_rules | 12.7s | 7898 |  |
| meals/H2-healthy-calorie-band | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ healthy_rules | 14.4s | 7188 |  |
| meals/H3-clean-out-expiry | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ clean_out_rules | 20.2s | 9298 |  |
| food/O1-big-mac | ✅ | ✓ calorie_range | 1.0s | 363 |  |
| food/O2-ramen | ✅ | ✓ calorie_range | 0.9s | 368 |  |
| food/O3-salad | ✅ | ✓ calorie_range | 1.0s | 368 |  |
| food/O4-burrito | ✅ | ✓ calorie_range | 1.2s | 397 |  |
| food/O5-injection | ✅ | ✓ injection_safe<br>✓ not_food | 1.5s | 448 | injection_attempt |
| food/O6-not-food | ✅ | ✓ not_food | 0.9s | 353 |  |
| workouts/W1-sedentary | ✅ | ✓ schema_valid<br>✓ difficulty_cap<br>process: exercisesInvented 0, byId 12, byName 0, removed 0 | 12.9s | 5111 |  |
| workouts/W2-strength-recent-chest | ✅ | ✓ schema_valid<br>✓ type_filter<br>✓ avoids_recent<br>process: exercisesInvented 0, byId 15, byName 0, removed 0 | 17.2s | 6741 |  |
| workouts/W3-flexibility | ✅ | ✓ schema_valid<br>✓ type_filter<br>✓ difficulty_cap<br>process: exercisesInvented 0, byId 15, byName 0, removed 0 | 12.5s | 5461 |  |
| workouts/W7-library-only | ✅ | ✓ schema_valid<br>✓ library_only<br>process: exercisesInvented 0, byId 15, byName 0, removed 0 | 14.8s | 6173 |  |
| workouts/W8-sedentary-level | ✅ | ✓ schema_valid<br>✓ difficulty_cap<br>✓ exercise_level<br>process: exercisesInvented 0, byId 8, byName 0, removed 0 | 12.3s | 4876 |  |
| week/W5-lose-fat-3 | ✅ | ✓ seven_days<br>✓ training_days<br>✓ two_rest<br>✓ no_back_to_back<br>✓ has_cardio<br>process: planSource ai | 3.3s | 748 |  |
| week/W6-very-active-5 | ✅ | ✓ seven_days<br>✓ training_days<br>✓ two_rest<br>✓ no_back_to_back<br>process: planSource ai | 2.8s | 825 |  |

## Failed outputs

## Example passing outputs

### meals/M1-basic-omnivore
```json
{
  "mode": null,
  "modeNote": null,
  "meals": [
    {
      "name": "Protein Oat Bowl with Boiled Eggs",
      "type": "Breakfast",
      "ingredients": [
        "60g oats",
        "150g greek yogurt",
        "1 banana",
        "2 eggs, hard-boiled"
      ],
      "structuredIngredients": [
        {
          "name": "oats",
          "quantity": 60,
          "unit": "g"
        },
        {
          "name": "greek yogurt",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "banana",
          "quantity": 1,
          "unit": "piece"
        },
        {
          "name": "egg",
          "quantity": 2,
          "unit": "piece"
        }
      ],
      "recipe": "Step 1: Hard-boil the 2 eggs in boiling water for 9 minutes, then cool in cold water and peel.\nStep 2: While the eggs cook, combine 60g oats with 120ml water in a small pot and simmer 3-4 minutes, stirring, until creamy.\nStep 3: Transfer the oats to a bowl and stir in the 150g greek yogurt.\nStep 4: Slice the banana on top and serve with the eggs on the side.",
      "calories": 627,
      "protein": 38,
      "carbs": 73,
      "fat": 21,
      "prepTime": "15 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Chicken, Broccoli and White Rice Bowl",
      "type": "Lunch",
      "ingredients": [
        "150g chicken breast",
        "150g cooked white rice",
        "150g broccoli florets"
      ],
      "structuredIngredients": [
        {
          "name": "chicken breast",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "white rice",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "broccoli",
          "quantity": 150,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Cook the white rice according to package directions and keep warm.\nStep 2: Cut the chicken breast into bite-sized pieces and season with salt and pepper.\nStep 3: Cook the chicken in a dry non-stick pan over medium-high heat for 5-6 minutes until golden and cooked through.\nStep 4: Steam the broccoli florets for 4-5 minutes until tender-crisp.\nStep 5: Serve the chicken and broccoli over the rice.",
      "calories": 494,
      "protein": 55,
      "carbs": 52,
      "fat": 6,
      "prepTime": "20 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Chicken and Egg Fried Rice",
      "type": "Dinner",
      "ingredients": [
        "150g chicken breast",
        "150g cooked white rice",
        "1 egg",
        "150g broccoli florets",
        "1 tbsp ol
```

### meals/M2-vegetarian-meat-in-fridge
```json
{
  "mode": null,
  "modeNote": null,
  "meals": [
    {
      "name": "Tofu, Spinach and Pepper Rice Bowl",
      "type": "Lunch",
      "ingredients": [
        "150g tofu",
        "150g brown rice (cooked)",
        "80g spinach",
        "1 bell pepper"
      ],
      "structuredIngredients": [
        {
          "name": "tofu",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "brown rice",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "spinach",
          "quantity": 80,
          "unit": "g"
        },
        {
          "name": "bell pepper",
          "quantity": 1,
          "unit": "piece"
        }
      ],
      "recipe": "Step 1: Cook the brown rice according to the package directions, or use 150g of pre-cooked rice.\nStep 2: Cut the tofu into 2cm cubes and pat dry with a paper towel.\nStep 3: Heat a non-stick pan over medium-high heat and sear the tofu cubes for 6-8 minutes, turning until golden on all sides.\nStep 4: Slice the bell pepper into strips and add to the pan for 3 minutes until slightly softened.\nStep 5: Add the spinach and toss for 1-2 minutes until just wilted.\nStep 6: Serve the tofu and vegetables over the brown rice in a bowl.",
      "calories": 456,
      "protein": 33,
      "carbs": 53,
      "fat": 16,
      "prepTime": "25 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Egg and Spinach Scramble with Tofu and Brown Rice",
      "type": "Dinner",
      "ingredients": [
        "2 eggs",
        "100g spinach",
        "1 bell pepper",
        "100g tofu",
        "100g brown rice (cooked)"
      ],
      "structuredIngredients": [
        {
          "name": "egg",
          "quantity": 2,
          "unit": "piece"
        },
        {
          "name": "spinach",
          "quantity": 100,
          "unit": "g"
        },
        {
          "name": "bell pepper",
          "quantity": 1,
          "unit": "piece"
        },
        {
          "name": "tofu",
          "quantity": 100,
          "unit": "g"
        },
        {
          "name": "brown rice",
          "quantity": 100,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Cook the brown rice according to the package directions, or use 100g of pre-cooked rice.\nStep 2: Dice the bell pepper and crumble the tofu into small pieces.\nStep 3: Heat a non-stick pan over medium heat and cook the bell pepper and tofu for 4-5 minutes until the pepper softens and the tofu lightly browns.\nStep 4: Add the spinach and stir for 1 minute until wilted.\nStep 5: Beat the eggs with a pinch of salt and pour into the pan. Stir gently for 2-3 minutes until just set.\nStep 6: Serve the scramble alongside the brown rice.",
      "calories": 470,
      "prote
```

### meals/M3-vegan-dairy-in-fridge
```json
{
  "mode": null,
  "modeNote": null,
  "meals": [
    {
      "name": "Sweet Potato and Avocado Kale Hash",
      "type": "Breakfast",
      "ingredients": [
        "130g sweet potato (1 piece)",
        "0.5 avocado (75g)",
        "40g kale",
        "5ml olive oil"
      ],
      "structuredIngredients": [
        {
          "name": "sweet potato",
          "quantity": 1,
          "unit": "piece"
        },
        {
          "name": "avocado",
          "quantity": 0.5,
          "unit": "piece"
        },
        {
          "name": "kale",
          "quantity": 40,
          "unit": "g"
        },
        {
          "name": "olive oil",
          "quantity": 5,
          "unit": "ml"
        }
      ],
      "recipe": "Step 1: Dice the sweet potato into 1 cm cubes.\nStep 2: Heat the olive oil in a non-stick pan over medium heat and add the sweet potato. Cover and cook for 10 to 12 minutes, stirring occasionally, until tender and lightly browned.\nStep 3: Chop the kale finely, add it to the pan and cook for 2 to 3 minutes until wilted.\nStep 4: Slice the avocado half and serve on top of the hash.",
      "calories": 296,
      "protein": 5,
      "carbs": 36,
      "fat": 17,
      "prepTime": "20 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Quinoa Chickpea Kale Bowl",
      "type": "Lunch",
      "ingredients": [
        "75g quinoa (dry)",
        "150g chickpeas",
        "80g kale",
        "5ml olive oil"
      ],
      "structuredIngredients": [
        {
          "name": "quinoa",
          "quantity": 75,
          "unit": "g"
        },
        {
          "name": "chickpeas",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "kale",
          "quantity": 80,
          "unit": "g"
        },
        {
          "name": "olive oil",
          "quantity": 5,
          "unit": "ml"
        }
      ],
      "recipe": "Step 1: Rinse the quinoa, then simmer it in 150ml water for 15 minutes until the water is absorbed. Fluff with a fork.\nStep 2: Drain and rinse the chickpeas, then pat them dry.\nStep 3: Heat the olive oil in a pan over medium-high heat, add the chickpeas and cook for 5 minutes until lightly crisp.\nStep 4: Massage the chopped kale with a pinch of salt for 1 minute, then add it to the pan for 2 minutes.\nStep 5: Combine the quinoa, chickpeas and kale in a bowl and season with salt, pepper and lemon juice if available.",
      "calories": 419,
      "protein": 20,
      "carbs": 64,
      "fat": 11,
      "prepTime": "25 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },

```