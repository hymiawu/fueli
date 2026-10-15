# Eval results — 2026-10-15T05:52:37.689Z

Model: `gpt-4o` · **17/17 cases passed**

| Case | Result | Checks | Latency | Tokens | Flags |
|---|---|---|---|---|---|
| meals/M1-basic-omnivore | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 8.8s | 4358 |  |
| meals/M2-vegetarian-meat-in-fridge | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 8.0s | 3718 |  |
| meals/M3-vegan-dairy-in-fridge | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 10.5s | 4190 |  |
| meals/M4-low-carb | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ diet_targets | 8.6s | 3900 |  |
| meals/M5-high-protein | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ diet_targets | 7.5s | 3659 |  |
| meals/M6-empty-fridge | ✅ | ✓ schema_valid<br>✓ macro_consistency<br>✓ macro_grounded | 6.4s | 3070 |  |
| meals/M7-injection-in-fridge-name | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ injection_safe | 5.6s | 3104 |  |
| meals/M8-few-items | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 5.4s | 2808 |  |
| food/O1-big-mac | ✅ | ✓ calorie_range | 0.7s | 229 |  |
| food/O2-ramen | ✅ | ✓ calorie_range | 0.7s | 235 |  |
| food/O3-salad | ✅ | ✓ calorie_range | 0.8s | 232 |  |
| food/O4-burrito | ✅ | ✓ calorie_range | 0.8s | 240 |  |
| food/O5-injection | ✅ | ✓ injection_safe<br>✓ not_food | 0.7s | 239 | injection_attempt |
| food/O6-not-food | ✅ | ✓ not_food | 1.0s | 225 |  |
| workouts/W1-sedentary | ✅ | ✓ schema_valid<br>✓ difficulty_cap | 4.6s | 1051 |  |
| workouts/W2-strength-recent-chest | ✅ | ✓ schema_valid<br>✓ type_filter<br>✓ avoids_recent | 5.6s | 1344 |  |
| workouts/W3-flexibility | ✅ | ✓ schema_valid<br>✓ type_filter<br>✓ difficulty_cap | 6.2s | 1241 |  |

## Failed outputs

## Example passing outputs

### meals/M1-basic-omnivore
```json
{
  "meals": [
    {
      "name": "Banana Oatmeal with Greek Yogurt",
      "type": "Breakfast",
      "ingredients": [
        "100g oats",
        "2 piece banana",
        "200g greek yogurt"
      ],
      "structuredIngredients": [
        {
          "name": "oats",
          "quantity": 100,
          "unit": "g"
        },
        {
          "name": "banana",
          "quantity": 2,
          "unit": "piece"
        },
        {
          "name": "greek yogurt",
          "quantity": 200,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Cook 100g of oats in water or milk until soft.\nStep 2: Slice 2 bananas and mix them into the oatmeal.\nStep 3: Top with 200g of Greek yogurt and serve.",
      "calories": 793,
      "protein": 37,
      "carbs": 128,
      "fat": 18,
      "prepTime": "15 min",
      "missingIngredients": [],
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Grilled Chicken with Broccoli and Rice",
      "type": "Lunch",
      "ingredients": [
        "200g chicken breast",
        "200g broccoli",
        "150g white rice"
      ],
      "structuredIngredients": [
        {
          "name": "chicken breast",
          "quantity": 200,
          "unit": "g"
        },
        {
          "name": "broccoli",
          "quantity": 200,
          "unit": "g"
        },
        {
          "name": "white rice",
          "quantity": 150,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Grill 200g of chicken breast until cooked through.\nStep 2: Steam 200g of broccoli until tender.\nStep 3: Cook 150g of white rice according to package instructions.\nStep 4: Serve the chicken with broccoli and rice on the side.",
      "calories": 593,
      "protein": 72,
      "carbs": 55,
      "fat": 8,
      "prepTime": "30 min",
      "missingIngredients": [],
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Egg and Broccoli Stir-fry",
      "type": "Dinner",
      "ingredients": [
        "4 piece egg",
        "200g broccoli",
        "100g white rice"
      ],
      "structuredIngredients": [
        {
          "name": "egg",
          "quantity": 4,
          "unit": "piece"
        },
        {
          "name": "broccoli",
          "quantity": 200,
          "unit": "g"
        },
        {
          "name": "white rice",
          "quantity": 100,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Cook 100g of white rice according to package instructions.\nStep 2: Stir-fry 200g of broccoli in a pan with a little oil.\nStep 3: Add 4 beaten eggs to the pan and scramble with the broccoli.\nStep 4: Serve the stir-fry over the cooked rice.",
      "calories": 484,
      "protein": 34,
      "carbs": 43,
      "fat": 20,
      "prepTime": "20 min",
      "missingIngredients": [],
      "warnings": [],
```

### meals/M2-vegetarian-meat-in-fridge
```json
{
  "meals": [
    {
      "name": "Tofu Stir-Fry with Spinach and Bell Pepper",
      "type": "Lunch",
      "ingredients": [
        "200g tofu",
        "100g spinach",
        "1 piece bell pepper"
      ],
      "structuredIngredients": [
        {
          "name": "tofu",
          "quantity": 200,
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
      "recipe": "Step 1: Cut the tofu into cubes and slice the bell pepper.\nStep 2: In a pan, heat some oil and add the tofu cubes. Cook until golden brown.\nStep 3: Add the sliced bell pepper and spinach to the pan. Stir-fry for about 5 minutes.\nStep 4: Season with salt and pepper to taste, and serve hot.",
      "calories": 348,
      "protein": 38,
      "carbs": 17,
      "fat": 19,
      "prepTime": "30 min",
      "missingIngredients": [],
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Brown Rice with Tofu and Spinach",
      "type": "Dinner",
      "ingredients": [
        "150g brown rice",
        "200g tofu",
        "100g spinach"
      ],
      "structuredIngredients": [
        {
          "name": "brown rice",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "tofu",
          "quantity": 200,
          "unit": "g"
        },
        {
          "name": "spinach",
          "quantity": 100,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Cook the brown rice according to package instructions.\nStep 2: While the rice is cooking, cut the tofu into cubes and sauté in a pan until golden brown.\nStep 3: Add spinach to the pan and cook until wilted.\nStep 4: Mix the cooked brown rice with the tofu and spinach. Season with salt and pepper to taste, and serve hot.",
      "calories": 496,
      "protein": 41,
      "carbs": 48,
      "fat": 20,
      "prepTime": "40 min",
      "missingIngredients": [],
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    }
  ],
  "blocked": []
}
```

### meals/M3-vegan-dairy-in-fridge
```json
{
  "meals": [
    {
      "name": "Chickpea Avocado Toast",
      "type": "Breakfast",
      "ingredients": [
        "200g chickpeas",
        "1 piece avocado"
      ],
      "structuredIngredients": [
        {
          "name": "chickpeas",
          "quantity": 200,
          "unit": "g"
        },
        {
          "name": "avocado",
          "quantity": 1,
          "unit": "piece"
        }
      ],
      "recipe": "Step 1: Mash the avocado and chickpeas together in a bowl.\nStep 2: Season with salt and pepper to taste.\nStep 3: Spread the mixture on whole grain toast.",
      "calories": 568,
      "protein": 21,
      "carbs": 68,
      "fat": 27,
      "prepTime": "10 min",
      "missingIngredients": [],
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Sweet Potato Kale Quinoa Salad",
      "type": "Lunch",
      "ingredients": [
        "2 piece sweet potato",
        "100g kale",
        "100g quinoa"
      ],
      "structuredIngredients": [
        {
          "name": "sweet potato",
          "quantity": 2,
          "unit": "piece"
        },
        {
          "name": "kale",
          "quantity": 100,
          "unit": "g"
        },
        {
          "name": "quinoa",
          "quantity": 100,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Peel and dice the sweet potatoes and roast them in the oven at 200°C for 25 minutes.\nStep 2: Cook the quinoa according to package instructions.\nStep 3: Chop the kale and massage it with a bit of olive oil.\nStep 4: Combine roasted sweet potatoes, cooked quinoa, and kale in a bowl. Toss with your favorite dressing.",
      "calories": 393,
      "protein": 13,
      "carbs": 82,
      "fat": 3,
      "prepTime": "35 min",
      "missingIngredients": [],
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtilization": 1,
      "nutritionCoverage": 1
    },
    {
      "name": "Quinoa Chickpea Stir-fry",
      "type": "Dinner",
      "ingredients": [
        "200g quinoa",
        "200g chickpeas",
        "100g kale"
      ],
      "structuredIngredients": [
        {
          "name": "quinoa",
          "quantity": 200,
          "unit": "g"
        },
        {
          "name": "chickpeas",
          "quantity": 200,
          "unit": "g"
        },
        {
          "name": "kale",
          "quantity": 100,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Cook the quinoa according to package instructions.\nStep 2: In a pan, sauté the chickpeas and kale with garlic and soy sauce until the kale is wilted.\nStep 3: Add the cooked quinoa to the pan and stir well.\nStep 4: Serve hot, garnished with sesame seeds if desired.",
      "calories": 617,
      "protein": 31,
      "carbs": 106,
      "fat": 10,
      "prepTime": "30 min",
      "missingIngredients": [],
      "warnings": [],
      "macroSource": "verified",
      "fridgeUtiliz
```