-- Ridhima's Closet — initial schema
-- Tables: items, outfits, user_preferences, wear_logs

create extension if not exists "pgcrypto";

create type item_category as enum ('top', 'bottom', 'outerwear', 'dress', 'shoes', 'accessory');
create type color_family as enum ('warm-deep', 'warm-light', 'cool-deep', 'cool-light', 'neutral');

create table items (
  id uuid primary key default gen_random_uuid(),
  category item_category not null,
  subcategory text,
  name text not null,
  description text,
  color_primary text,
  color_family color_family,
  silhouette text,
  length text,
  formality smallint check (formality between 1 and 5),
  photo_url text,
  tags text[] default '{}',
  last_worn_date date,
  flatters_me boolean default true,
  created_at timestamptz not null default now()
);

create table outfits (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  item_ids uuid[] not null,
  occasion text,
  weather_summary text,
  was_worn boolean default false,
  user_rating smallint check (user_rating between 1 and 5),
  ai_reasoning text,
  created_at timestamptz not null default now()
);

create table user_preferences (
  id uuid primary key default gen_random_uuid(),
  color_season text not null,
  body_notes text,
  style_rules text[] default '{}',
  no_go_rules text[] default '{}',
  voice_tone text,
  created_at timestamptz not null default now()
);

create table wear_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  outfit_id uuid references outfits(id) on delete set null,
  worn_on date not null,
  created_at timestamptz not null default now()
);

create index idx_items_last_worn on items(last_worn_date);
create index idx_items_category on items(category);
create index idx_wear_logs_item on wear_logs(item_id);
create index idx_wear_logs_worn_on on wear_logs(worn_on);
create index idx_outfits_date on outfits(date);

-- Seed Ridhima's hardcoded preferences (single row for Phase 1)
insert into user_preferences (color_season, body_notes, style_rules, no_go_rules, voice_tone) values (
  'deep-autumn',
  'Bigger thighs and hips. High-rise bottoms always. No hemlines above the knee. Balanced proportions: if top is fitted, bottom is flowy; if top is oversized, bottom is fitted.',
  array[
    'Prefer warm-deep tones near the face (rust, terracotta, camel, espresso, mustard, burgundy, forest, coral, copper)',
    'High-rise bottoms always',
    'No hemlines above the knee',
    'Volume balance: never both top and bottom in same volume',
    'Do not repeat any single item within 5 days',
    'Aesthetic: warm-feminine-polished (off-shoulder, smocking, peplum, embroidery)'
  ],
  array[
    'Cool pastels near the face (dusty pink, baby blue, mint, sage)',
    'Short hemlines',
    'Anything that tapers tightly at the hip'
  ],
  'warm, knowing, like a friend who happens to be a stylist (Nancy Chu-inspired). Direct, no fluff. Two sentences max. No em dashes. No cheerleading.'
);
