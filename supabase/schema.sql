-- ─────────────────────────────────────────────────────────────────────────────
-- Fuel Tracker — Supabase database setup
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query →
-- paste this whole file → Run.
-- It creates three tables and turns on Row-Level Security so each signed-in user
-- can only read/write their OWN rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) PROFILE: one row per user (name, body stats, goal)
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text,
  age        text,
  sex        text,
  weight     text,
  height     text,
  goal       text,
  updated_at timestamptz not null default now()
);

-- 2) ENTRIES: one row per logged food item, on a given day
create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  name       text,
  calories   numeric,
  protein    numeric,
  carbs      numeric,
  fat        numeric,
  meal       text,
  qty        numeric,
  created_at timestamptz not null default now()
);
create index if not exists entries_user_day_idx on public.entries (user_id, day);

-- 3) WEIGHTS: one weigh-in per user per day (logging again updates that day)
create table if not exists public.weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  weight  numeric not null,
  primary key (user_id, day)
);

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.entries  enable row level security;
alter table public.weights  enable row level security;

-- Each user can do anything ONLY to rows where user_id = their own id.
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own weights" on public.weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
