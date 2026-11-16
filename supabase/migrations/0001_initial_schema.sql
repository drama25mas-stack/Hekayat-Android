create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  description text,
  category_id uuid references public.categories(id) on delete set null,
  video_object_key text not null,
  cover_object_key text,
  duration_seconds bigint,
  mime_type text not null default 'video/mp4',
  file_size_bytes bigint,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_public_feed_idx
  on public.stories (published_at desc) where status = 'published';

create table if not exists public.story_views (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.stories(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "public read published stories" on public.stories;
create policy "public read published stories" on public.stories
  for select to anon, authenticated using (status = 'published');

-- All writes are performed by the trusted Worker using its server-side secret.
-- Do not expose the Supabase service-role key in the Android application.
