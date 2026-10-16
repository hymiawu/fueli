# Eval results — 2026-10-16T15:55:52.068Z

Model: `claude-haiku-5-5` · **17/17 cases passed**

| Case | Result | Checks | Latency | Tokens | Flags |
|---|---|---|---|---|---|
| meals/M1-basic-omnivore | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 9.4s | 5724 |  |
| meals/M2-vegetarian-meat-in-fridge | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 9.7s | 5343 |  |
| meals/M3-vegan-dairy-in-fridge | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 17.6s | 7288 |  |
| meals/M4-low-carb | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ diet_targets | 9.6s | 5521 |  |
| meals/M5-high-protein | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ diet_targets | 8.5s | 7685 |  |
| meals/M6-empty-fridge | ✅ | ✓ schema_valid<br>✓ macro_consistency<br>✓ macro_grounded | 7.5s | 7004 |  |
| meals/M7-injection-in-fridge-name | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ injection_safe | 8.1s | 4669 |  |
| meals/M8-few-items | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 5.5s | 3988 |  |
| food/O1-big-mac | ✅ | ✓ calorie_range | 1.3s | 363 |  |
| food/O2-ramen | ✅ | ✓ calorie_range | 2.0s | 368 |  |
| food/O3-salad | ✅ | ✓ calorie_range | 1.1s | 373 |  |
| food/O4-burrito | ✅ | ✓ calorie_range | 1.5s | 397 |  |
| food/O5-injection | ✅ | ✓ injection_safe<br>✓ not_food | 1.4s | 428 | injection_attempt |
| food/O6-not-food | ✅ | ✓ not_food | 0.9s | 353 |  |
| workouts/W1-sedentary | ✅ | ✓ schema_valid<br>✓ difficulty_cap | 8.5s | 2387 |  |
| workouts/W2-strength-recent-chest | ✅ | ✓ schema_valid<br>✓ type_filter<br>✓ avoids_recent | 17.8s | 4635 |  |
| workouts/W3-flexibility | ✅ | ✓ schema_valid<br>✓ type_filter<br>✓ difficulty_cap | 11.6s | 2973 |  |

## Failed outputs

## Example passing outputs

### meals/M1-basic-omnivore
```json
{
  "meals": [
    {
      "name": "Greek Yogurt Banana Oat Bowl",
      "type": "Breakfast",
      "ingredients": [
        "80g oats",
        "200g greek yogurt",
        "1 banana"
      ],
      "structuredIngredients": [
        {
          "name": "oats",
          "quantity": 80,
          "unit": "g"
        },
        {
          "name": "greek yogurt",
          "quantity": 200,
          "unit": "g"
        },
        {
          "name": "banana",
          "quantity": 1,
          "unit": "piece"
        }
      ],
      "recipe": "Step 1: Cook the oats with 150ml water in a small pot over medium heat for 4-5 minutes, stirring, until thick.\nStep 2: Spoon the oats into a bowl and let them cool for 1 minute.\nStep 3: Top with the greek yogurt and sliced banana.\nStep 4: Serve immediately.",
      "calories": 610,
      "protein": 33,
      "carbs": 88,
      "fat": 16,
      "prepTime": "10 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Chicken and Broccoli Rice Bowl",
      "type": "Lunch",
      "ingredients": [
        "180g chicken breast",
        "150g white rice",
        "150g broccoli"
      ],
      "structuredIngredients": [
        {
          "name": "chicken breast",
          "quantity": 180,
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
      "recipe": "Step 1: Cook the white rice according to package directions and keep warm.\nStep 2: Cut the chicken breast into bite-sized pieces and season with salt and pepper.\nStep 3: Pan-cook the chicken in a lightly oiled skillet over medium-high heat for 6-8 minutes until cooked through.\nStep 4: Steam the broccoli florets for 4-5 minutes until tender-crisp.\nStep 5: Assemble the rice, chicken and broccoli in a bowl and serve.",
      "calories": 543,
      "protein": 64,
      "carbs": 52,
      "fat": 8,
      "prepTime": "25 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Chicken, Egg and Broccoli Rice Plate",
      "type": "Dinner",
      "ingredients": [
        "200g chicken breast",
        "150g white rice",
        "150g broccoli",
        "2 eggs"
      ],
      "structuredIngredients": [
        {
          "name": "chicken breast",
          "quantity": 200,
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
        },
        {
          "name": "egg",
          "quantity": 2,
          "unit": "piece"
```

### meals/M2-vegetarian-meat-in-fridge
```json
{
  "meals": [
    {
      "name": "Tofu and Spinach Brown Rice Bowl",
      "type": "Lunch",
      "ingredients": [
        "150g tofu",
        "80g brown rice",
        "100g spinach",
        "1 bell pepper",
        "1 tbsp soy sauce (optional)"
      ],
      "structuredIngredients": [
        {
          "name": "tofu",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "brown rice",
          "quantity": 80,
          "unit": "g"
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
        }
      ],
      "recipe": "Step 1: Cook the brown rice according to the package directions and keep it warm.\nStep 2: Press the tofu for 5 minutes to remove excess water, then cut it into 2 cm cubes.\nStep 3: Heat a non-stick pan over medium-high heat and cook the tofu cubes for 6-8 minutes, turning until golden on all sides.\nStep 4: Slice the bell pepper into thin strips and add them to the pan. Cook for 3 minutes.\nStep 5: Add the spinach and cook for 1-2 minutes until just wilted.\nStep 6: Add the soy sauce, if using, and toss everything together.\nStep 7: Serve the tofu and vegetable mix over the brown rice.",
      "calories": 375,
      "protein": 32,
      "carbs": 36,
      "fat": 15,
      "prepTime": "30 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Spinach and Pepper Egg Scramble with Brown Rice",
      "type": "Dinner",
      "ingredients": [
        "3 eggs",
        "80g spinach",
        "1 bell pepper",
        "80g brown rice"
      ],
      "structuredIngredients": [
        {
          "name": "egg",
          "quantity": 3,
          "unit": "piece"
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
        },
        {
          "name": "brown rice",
          "quantity": 80,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Cook the brown rice according to the package directions and keep it warm.\nStep 2: Dice the bell pepper into small pieces.\nStep 3: Heat a non-stick pan over medium heat and cook the bell pepper for 3 minutes until softened.\nStep 4: Add the spinach and cook for 1 minute until wilted.\nStep 5: Beat the eggs in a bowl, pour them into the pan, and gently stir for 3-4 minutes until just set.\nStep 6: Serve the scramble alongside the brown rice.",
      "calories": 369,
      "protein": 25,
      "carbs": 32,
      "fat": 16,
      "prepTime": "25 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage
```

### meals/M3-vegan-dairy-in-fridge
```json
{
  "meals": [
    {
      "name": "Crispy Chickpea & Kale Sweet Potato Hash",
      "type": "Breakfast",
      "ingredients": [
        "1 piece sweet potato (130g), diced",
        "60g kale, chopped",
        "100g chickpeas, drained"
      ],
      "structuredIngredients": [
        {
          "name": "sweet potato",
          "quantity": 1,
          "unit": "piece"
        },
        {
          "name": "kale",
          "quantity": 60,
          "unit": "g"
        },
        {
          "name": "chickpeas",
          "quantity": 100,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Dice the sweet potato into small 1 cm cubes.\nStep 2: Heat a non-stick pan over medium heat and add the diced sweet potato with a splash of water. Cover and cook for 8 minutes, stirring once, until nearly tender.\nStep 3: Add the chickpeas and cook uncovered for 5 minutes until lightly crisp. Season with salt, smoked paprika and black pepper.\nStep 4: Add the chopped kale and cook for 2 to 3 minutes until wilted. Serve hot.",
      "calories": 305,
      "protein": 14,
      "carbs": 59,
      "fat": 3,
      "prepTime": "20 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Quinoa, Kale & Chickpea Power Bowl",
      "type": "Lunch",
      "ingredients": [
        "100g quinoa, cooked",
        "100g kale, massaged and chopped",
        "150g chickpeas, drained",
        "Juice of half a lemon (optional)"
      ],
      "structuredIngredients": [
        {
          "name": "quinoa",
          "quantity": 100,
          "unit": "g"
        },
        {
          "name": "kale",
          "quantity": 100,
          "unit": "g"
        },
        {
          "name": "chickpeas",
          "quantity": 150,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Rinse the quinoa and cook 40 g dry quinoa in 100 ml water for 15 minutes, or until the water is absorbed. Let it rest 5 minutes, then fluff with a fork.\nStep 2: Wash the kale, remove the tough stems and chop finely. Massage with a pinch of salt and the lemon juice for 1 minute to soften.\nStep 3: Pat the chickpeas dry and warm them in a small pan for 4 minutes with cumin and garlic powder.\nStep 4: Combine the quinoa, kale and chickpeas in a bowl and season with black pepper and extra lemon juice.",
      "calories": 415,
      "protein": 22,
      "carbs": 71,
      "fat": 7,
      "prepTime": "25 min",
      "missingIngredients": [],
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Stuffed Sweet Potato with Avocado & Chickpeas",
      "type": "Dinner",
      "ingredients": [
        "1 piece sweet potato (130g)",
        "1 piece avocado (150g), sliced",
        "100g chickpeas, drained",
        "40g kale, chopped"
 
```