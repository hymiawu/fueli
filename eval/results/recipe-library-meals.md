# Eval results: meals suite with the recipe library (D-19)

Model: `claude-haiku-5-5` · **12/12 cases passed**

| Case | Result | Checks | Latency | Tokens | Flags |
|---|---|---|---|---|---|
| meals/M1-basic-omnivore | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 0.9s | 0 | library |
| meals/M2-vegetarian-meat-in-fridge | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 0.8s | 0 | library |
| meals/M3-vegan-dairy-in-fridge | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 0.7s | 0 | library |
| meals/M4-low-carb | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ diet_targets | 0.6s | 0 | library |
| meals/M5-high-protein | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ diet_targets | 0.5s | 0 | library |
| meals/M6-empty-fridge | ✅ | ✓ schema_valid<br>✓ macro_consistency<br>✓ macro_grounded | 0.5s | 0 | library |
| meals/M7-injection-in-fridge-name | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ injection_safe | 0.5s | 0 | library |
| meals/M8-few-items | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded | 0.4s | 0 | library |
| meals/M9-peanut-allergy | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ allergy_safe | 0.4s | 0 | library |
| meals/H1-hungry-stock-and-time | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ hungry_rules | 0.3s | 0 | library |
| meals/H2-healthy-calorie-band | ✅ | ✓ schema_valid<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ healthy_rules | 0.2s | 0 | library |
| meals/H3-clean-out-expiry | ✅ | ✓ schema_valid<br>✓ diet_compliant<br>✓ fridge_utilization<br>✓ macro_consistency<br>✓ macro_grounded<br>✓ clean_out_rules | 0.1s | 0 | library |

## Failed outputs

## Example passing outputs

### meals/M1-basic-omnivore
```json
{
  "mode": null,
  "modeNote": null,
  "meals": [
    {
      "name": "Spinach and mushroom omelette",
      "type": "Breakfast",
      "ingredients": [
        "3 piece egg",
        "1 tsp olive oil",
        "1 pinch salt"
      ],
      "structuredIngredients": [
        {
          "name": "egg",
          "quantity": 3,
          "unit": "piece"
        },
        {
          "name": "olive oil",
          "quantity": 1,
          "unit": "tsp"
        },
        {
          "name": "salt",
          "quantity": 1,
          "unit": "pinch"
        }
      ],
      "recipe": "Step 1: Slice the mushrooms and cook them in the oil for 3 minutes, then add the spinach until wilted.\nStep 2: Beat the eggs with a pinch of salt, pour over the vegetables and cook on low heat.\nStep 3: Sprinkle the cheese, fold and serve.\nOptional if you have it: spinach, mushroom, cheddar cheese.",
      "calories": 259,
      "protein": 19,
      "carbs": 1,
      "fat": 19,
      "prepTime": "12 min",
      "missingIngredients": [],
      "recipeId": "spinach-mushroom-omelette",
      "flex": false,
      "main": "egg",
      "portion": 1,
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1,
      "recipeSource": "library"
    },
    {
      "name": "Use-it-up egg fried rice",
      "type": "Lunch",
      "ingredients": [
        "170 g brown rice",
        "2 piece egg",
        "1 tsp olive oil",
        "60 g broccoli"
      ],
      "structuredIngredients": [
        {
          "name": "brown rice",
          "quantity": 170,
          "unit": "g"
        },
        {
          "name": "egg",
          "quantity": 2,
          "unit": "piece"
        },
        {
          "name": "olive oil",
          "quantity": 1,
          "unit": "tsp"
        },
        {
          "name": "broccoli",
          "quantity": 60,
          "unit": "g"
        }
      ],
      "recipe": "Step 1: Cook the protein in the oil (eggs last), then the chopped vegetables for 4 minutes.\nStep 2: Add the cooked grain and fry 3 minutes; season with soy sauce or salt.\nOptional if you have it: spinach, kale, mushroom, bell pepper, zucchini, tomato, onion, carrot, peas, corn, soy sauce, lettuce, cucumber, sweet potato, potato, avocado, garlic.",
      "calories": 417,
      "protein": 19,
      "carbs": 48,
      "fat": 16,
      "prepTime": "15 min",
      "missingIngredients": [],
      "recipeId": "use-it-up-fried-rice",
      "flex": true,
      "main": "brown rice",
      "portion": 1,
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1,
      "recipeSource": "library"
    },
    {
      "name": "One-pan chicken thigh and rice",
      "type": "Dinner",
      "ingredients": [
        "150 
```

### meals/M2-vegetarian-meat-in-fridge
```json
{
  "mode": null,
  "modeNote": null,
  "meals": [
    {
      "name": "Use-it-up spinach lettuce bowl",
      "type": "Lunch",
      "ingredients": [
        "70 g spinach",
        "2 piece egg",
        "1 tbsp olive oil",
        "0.5 piece bell pepper"
      ],
      "structuredIngredients": [
        {
          "name": "spinach",
          "quantity": 70,
          "unit": "g"
        },
        {
          "name": "egg",
          "quantity": 2,
          "unit": "piece"
        },
        {
          "name": "olive oil",
          "quantity": 1,
          "unit": "tbsp"
        },
        {
          "name": "bell pepper",
          "quantity": 0.5,
          "unit": "piece"
        }
      ],
      "recipe": "Step 1: Cook the protein if it needs it.\nStep 2: Pile it on the greens with whatever vegetables you have and dress with oil and lemon.\nOptional if you have it: mushroom, tomato, onion, carrot, avocado, lemon, greek yogurt, cheddar cheese.",
      "calories": 310,
      "protein": 15,
      "carbs": 7,
      "fat": 25,
      "prepTime": "10 min",
      "missingIngredients": [],
      "recipeId": "use-it-up-lettuce-bowl",
      "flex": true,
      "main": "egg",
      "portion": 1,
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1,
      "recipeSource": "library"
    },
    {
      "name": "Tofu tomato curry",
      "type": "Dinner",
      "ingredients": [
        "150 g tofu",
        "1 piece tomato",
        "0.5 piece onion",
        "150 g white rice",
        "50 g spinach",
        "1 tsp curry spice"
      ],
      "structuredIngredients": [
        {
          "name": "tofu",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "tomato",
          "quantity": 1,
          "unit": "piece"
        },
        {
          "name": "onion",
          "quantity": 0.5,
          "unit": "piece"
        },
        {
          "name": "white rice",
          "quantity": 150,
          "unit": "g"
        },
        {
          "name": "spinach",
          "quantity": 50,
          "unit": "g"
        },
        {
          "name": "curry spice",
          "quantity": 1,
          "unit": "tsp"
        }
      ],
      "recipe": "Step 1: Soften the onion, add the curry spice and tomato and simmer 5 minutes.\nStep 2: Add the cubed tofu and spinach for 5 minutes and serve with rice.",
      "calories": 466,
      "protein": 33,
      "carbs": 58,
      "fat": 14,
      "prepTime": "25 min",
      "missingIngredients": [
        "tomato (1 piece)",
        "onion (0.5 piece)"
      ],
      "recipeId": "tofu-curry",
      "flex": false,
      "main": "tofu",
      "portion": 1,
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 0.6,
      "
```

### meals/M3-vegan-dairy-in-fridge
```json
{
  "mode": null,
  "modeNote": null,
  "meals": [
    {
      "name": "Use-it-up quinoa fruit bowl",
      "type": "Breakfast",
      "ingredients": [
        "170 g quinoa",
        "150 ml soy milk"
      ],
      "structuredIngredients": [
        {
          "name": "quinoa",
          "quantity": 170,
          "unit": "g"
        },
        {
          "name": "soy milk",
          "quantity": 150,
          "unit": "ml"
        }
      ],
      "recipe": "Step 1: Use the oats or quinoa with warm milk, or the yogurt or cottage cheese as it is.\nStep 2: Top with whatever fruit and nuts you have.\nOptional if you have it: banana, apple, orange, strawberries, blueberries, walnuts, almonds, milk.",
      "calories": 285,
      "protein": 12,
      "carbs": 45,
      "fat": 6,
      "prepTime": "5 min",
      "missingIngredients": [],
      "recipeId": "use-it-up-fruit-bowl",
      "flex": true,
      "main": "quinoa",
      "portion": 1,
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 1,
      "nutritionCoverage": 1,
      "recipeSource": "library"
    },
    {
      "name": "Sweet potato black bean bowl",
      "type": "Lunch",
      "ingredients": [
        "1 piece sweet potato",
        "100 g black beans",
        "30 g kale",
        "0.25 piece avocado"
      ],
      "structuredIngredients": [
        {
          "name": "sweet potato",
          "quantity": 1,
          "unit": "piece"
        },
        {
          "name": "black beans",
          "quantity": 100,
          "unit": "g"
        },
        {
          "name": "kale",
          "quantity": 30,
          "unit": "g"
        },
        {
          "name": "avocado",
          "quantity": 0.25,
          "unit": "piece"
        }
      ],
      "recipe": "Step 1: Cube the sweet potato and roast or microwave until tender, about 10 to 20 minutes.\nStep 2: Serve with the warm beans, kale and avocado and squeeze over the lemon.\nOptional if you have it: lemon.",
      "calories": 319,
      "protein": 13,
      "carbs": 56,
      "fat": 6,
      "prepTime": "25 min",
      "missingIngredients": [
        "black beans (100 g)"
      ],
      "recipeId": "sweet-potato-bean-bowl",
      "flex": false,
      "main": "black beans",
      "portion": 1,
      "servings": 1,
      "warnings": [],
      "macroSource": "verified",
      "shortIngredients": [],
      "unverifiedIngredients": [],
      "fridgeUtilization": 0.75,
      "nutritionCoverage": 1,
      "recipeSource": "library"
    },
    {
      "name": "Chickpea tomato pasta",
      "type": "Dinner",
      "ingredients": [
        "160 g pasta",
        "100 g chickpeas",
        "2 piece tomato",
        "1 tsp olive oil"
      ],
      "structuredIngredients": [
        {
          "name": "pasta",
          "quantity": 160,
          "unit": "g"
        },
        {
          "name": "chickpeas",
       
```