-- The fridge inventory table, matching the live project's schema (read from Supabase on 2026-10-16).
-- Values are stored as text because the app writes them as entered. Run before 001 and 002. Safe to re-run.

create table if not exists public.ingredients (
  id text primary key,          -- set by the client
  user_id uuid not null,        -- owner; enforced by the RLS policies in 001
  name text not null,
  quantity text,
  unit text,
  category text,
  expiry text,
  calories text,
  protein text,
  carbs text,
  fat text,
  created_at timestamptz default now()
);
