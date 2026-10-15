-- Row Level Security for the fridge inventory. The Fly API queries Supabase *as the signed-in user*
-- (using their JWT, not a service-role key), so these policies are what keeps users' data separate.
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.ingredients enable row level security;

drop policy if exists "own ingredients: select" on public.ingredients;
drop policy if exists "own ingredients: insert" on public.ingredients;
drop policy if exists "own ingredients: update" on public.ingredients;
drop policy if exists "own ingredients: delete" on public.ingredients;

create policy "own ingredients: select" on public.ingredients for select using (auth.uid() = user_id);
create policy "own ingredients: insert" on public.ingredients for insert with check (auth.uid() = user_id);
create policy "own ingredients: update" on public.ingredients for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own ingredients: delete" on public.ingredients for delete using (auth.uid() = user_id);
