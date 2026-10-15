-- Subscription status, written only by the Fly API (service role) from Stripe data.
-- Users can read their own row; there are no insert/update/delete policies, so they cannot change it.
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "own subscription: select" on public.subscriptions;
create policy "own subscription: select" on public.subscriptions for select using (auth.uid() = user_id);

-- Accounts that existed before payments were required keep free access.
insert into public.subscriptions (user_id, status)
select id, 'grandfathered' from auth.users
on conflict (user_id) do nothing;
