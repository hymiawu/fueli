// Shared by the manual Add Ingredient form and the Scan form, so every fridge item uses the
// same categories (FridgeScreen colors them by these names) and units the server understands.
export const CATEGORIES = ['Produce', 'Protein', 'Dairy', 'Grains', 'Beverages', 'Condiments', 'Other'];
export const UNITS = ['g', 'kg', 'ml', 'L', 'piece', 'cup', 'tbsp'];
// Same six as the server's Safety Guard (D-48). Stored as an array in the profile, comma-separated on fridge items.
export const ALLERGENS = ['Peanuts', 'Tree nuts', 'Shellfish', 'Dairy', 'Eggs', 'Gluten'];
export const parseAllergens = (v) =>
  (Array.isArray(v) ? v : String(v || '').split(',')).map((a) => a.trim()).filter((a) => ALLERGENS.includes(a));
