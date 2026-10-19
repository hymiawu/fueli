-- Serving size, servings per package and allergens on fridge items (handoff 6.1.1 and 6.1.3).
-- Nutrition stays stored per 100 g; per serving and per package are derived from these two numbers.
-- All three columns are optional text, like the others, so existing rows are unchanged. Run after 000 to 002. Safe to re-run.

alter table public.ingredients add column if not exists serving_size text;           -- grams (or ml, 1 ml = 1 g) in one serving
alter table public.ingredients add column if not exists servings_per_container text; -- number of servings in the whole package
alter table public.ingredients add column if not exists allergens text;              -- comma-separated, from the six in the profile list
