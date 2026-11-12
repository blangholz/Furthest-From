-- Far From Fries: core schema.
-- Privacy rule that shapes everything here: no table stores where a player was
-- when they logged. Exact coordinates go into fff.submit_log(), which scores
-- them and throws them away. The only stored coordinates belong to McDonald's
-- stores, the public State Extremes / Top 100 spots, and each player's own home
-- pin (readable only by that player).

-- Everything lives in two schemas of its own, so the app can share a Supabase
-- project with other apps without touching their tables:
--   fff          tables and the RPCs the app calls (add it to the API's exposed schemas)
--   fff_private  internals, never exposed
-- PostGIS is used from wherever the project already has it (extensions or public).
create schema if not exists extensions;
do $$ begin
  if not exists (select 1 from pg_extension where extname = 'postgis') then
    create extension postgis with schema extensions;
  end if;
end $$;
create schema if not exists fff;
create schema if not exists fff_private;
revoke all on schema fff_private from public, anon, authenticated;
set search_path = fff, extensions, public;

-- ---------------------------------------------------------------------------
-- Game settings (one row). Tweak numbers here instead of in code.
-- ---------------------------------------------------------------------------
create table fff.game_settings (
  id boolean primary key default true check (id),
  ping_local_time time not null default '13:20',         -- 1:20 PM in each player's own time zone
  ping_window interval not null default '1 hour',
  late_upload_grace interval not null default '24 hours', -- queued offline logs accepted this long after
  home_radius_m double precision not null default 8046.72, -- 5 miles
  claim_radius_m double precision not null default 45.72,  -- 150 ft
  fries_per_credits int not null default 7,                 -- 7 qualifying pings = 1 Extra Fries
  double_credit_streak int not null default 12,             -- at a 12+ streak each ping counts double
  fries_ttl interval not null default '14 days',
  fries_warn_before interval not null default '48 hours',
  global_min_friends int not null default 3,
  season_time_zone text not null default 'America/Los_Angeles',
  spot_match_radius_m double precision not null default 3218.69 -- 2 mi: a refreshed spot this close keeps its id
);
insert into fff.game_settings default values;

create or replace function fff_private.settings() returns fff.game_settings
language sql stable set search_path = fff, extensions, public as $$ select * from fff.game_settings limit 1 $$;

-- ---------------------------------------------------------------------------
-- Seasons: meteorological calendar seasons (Mar, Jun, Sep, Dec 1st), in Pacific time.
-- ---------------------------------------------------------------------------
create table fff.seasons (
  id serial primary key,
  name text not null,
  starts_at timestamptz not null unique,
  ends_at timestamptz not null
);

create or replace function fff_private.season_for(p_ts timestamptz)
returns fff.seasons
language plpgsql set search_path = fff, extensions, public as $$
declare
  tz text := (fff_private.settings()).season_time_zone;
  loc timestamp := p_ts at time zone tz;
  m int := extract(month from loc);
  y int := extract(year from loc);
  sm int; sy int; nm text; s fff.seasons;
begin
  if m in (3,4,5) then sm := 3; sy := y; nm := 'Spring ' || y;
  elsif m in (6,7,8) then sm := 6; sy := y; nm := 'Summer ' || y;
  elsif m in (9,10,11) then sm := 9; sy := y; nm := 'Fall ' || y;
  elsif m = 12 then sm := 12; sy := y; nm := 'Winter ' || y || '-' || right((y + 1)::text, 2);
  else sm := 12; sy := y - 1; nm := 'Winter ' || (y - 1) || '-' || right(y::text, 2);
  end if;
  insert into fff.seasons (name, starts_at, ends_at)
  values (nm,
          make_timestamp(sy, sm, 1, 0, 0, 0) at time zone tz,
          (make_timestamp(sy, sm, 1, 0, 0, 0) + interval '3 months') at time zone tz)
  on conflict (starts_at) do nothing;
  select * into s from fff.seasons where starts_at = make_timestamp(sy, sm, 1, 0, 0, 0) at time zone tz;
  return s;
end $$;

-- ---------------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------------
create table fff.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  time_zone text not null default 'America/Los_Angeles',
  home_point geography(point, 4326),            -- exact, private to the owner
  home_season_id int references fff.seasons (id),      -- season the pin was set in (locks it)
  streak_count int not null default 0,
  best_streak int not null default 0,
  fries_credits int not null default 0,                    -- progress toward the next Extra Fries
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- No trigger on auth.users: the sign-in list may be shared with other apps, so a
-- profile is made only when someone opens Far From Fries (fff.ensure_profile).

create table fff.friendships (
  user_a uuid not null references fff.profiles (id) on delete cascade,
  user_b uuid not null references fff.profiles (id) on delete cascade,
  requested_by uuid not null references fff.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_b on fff.friendships (user_b);

create table fff.invites (
  code text primary key,
  inviter uuid not null references fff.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  uses int not null default 0
);

create table fff.push_tokens (
  token text primary key,
  user_id uuid not null references fff.profiles (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index push_tokens_user on fff.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Reference data: McDonald's stores, regions, State Extremes and Top 100 spots
-- ---------------------------------------------------------------------------
create table fff.data_versions (
  id serial primary key,
  source text not null,
  notes text,
  store_count int,
  spot_count int,
  imported_at timestamptz not null default now()
);

create table fff.stores (
  id bigserial primary key,
  source_id text,
  geom geography(point, 4326) not null,
  country text,
  state text,
  city text,
  data_version_id int references fff.data_versions (id)
);
create index stores_geom on fff.stores using gist (geom);

-- US states (with a lower-48 flag) and countries, for zone and Passport region.
create table fff.regions (
  code text primary key,        -- 'US-NV', 'IS'
  name text not null,           -- 'Nevada', 'Iceland'
  kind text not null check (kind in ('us_state', 'country')),
  lower48 boolean not null default false,
  geom geometry(multipolygon, 4326) not null
);
create index regions_geom on fff.regions using gist (geom);

create table fff.extremes (
  id bigserial primary key,
  kind text not null check (kind in ('state', 'top100')),
  state text not null,                 -- two-letter code
  rank int,                            -- Top 100 rank (1 = furthest in the lower 48)
  geom geography(point, 4326) not null,
  distance_mi numeric(6, 1) not null,
  land text,                           -- land manager, e.g. 'Tonopah Field Office (BLM, OA)'
  nearest text,
  active boolean not null default true,
  data_version_id int references fff.data_versions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz
);
create unique index extremes_one_active_state on fff.extremes (state) where kind = 'state' and active;
create unique index extremes_one_active_rank on fff.extremes (rank) where kind = 'top100' and active;

-- ---------------------------------------------------------------------------
-- Pings, logs, Extra Fries, ticks
-- ---------------------------------------------------------------------------
-- One row per player per local day: their 1:20 PM ping in the time zone their phone reported.
create table fff.ping_deliveries (
  id bigserial primary key,
  user_id uuid not null references fff.profiles (id) on delete cascade,
  local_date date not null,
  time_zone text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'logged', 'missed')),
  log_id bigint,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);
create index ping_deliveries_open on fff.ping_deliveries (closes_at) where status = 'open';

create table fff.logs (
  id bigserial primary key,
  user_id uuid not null references fff.profiles (id) on delete cascade,
  kind text not null check (kind in ('ping', 'extra_fries', 'extreme')),
  zone text not null check (zone in ('scoring', 'home', 'passport')),
  distance_mi numeric(8, 2) not null,
  points numeric(8, 2) generated always as (case when zone = 'scoring' then distance_mi else 0 end) stored,
  region_code text,      -- 'US-NV', 'IS'. State or country only, never finer.
  region_name text,
  season_id int not null references fff.seasons (id),
  delivery_id bigint references fff.ping_deliveries (id) on delete set null,
  extreme_id bigint references fff.extremes (id),
  data_version_id int references fff.data_versions (id),
  logged_at timestamptz not null,   -- when the player opened the app (the score locks here)
  created_at timestamptz not null default now()
  -- No coordinates. Ever.
);
create index logs_user_time on fff.logs (user_id, logged_at desc);
create index logs_season on fff.logs (season_id, user_id) where zone = 'scoring';
alter table fff.ping_deliveries
  add constraint ping_deliveries_log foreign key (log_id) references fff.logs (id) on delete set null;

create table fff.extra_fries (
  id bigserial primary key,
  user_id uuid not null references fff.profiles (id) on delete cascade,
  earned_at timestamptz not null,
  expires_at timestamptz not null,
  earned_from_log_id bigint references fff.logs (id) on delete set null,
  used_at timestamptz,
  used_log_id bigint references fff.logs (id) on delete set null,
  warned_at timestamptz
);
create index extra_fries_user on fff.extra_fries (user_id, expires_at) where used_at is null;

-- A claimed State Extreme or Top 100 spot. Permanent, even after the spot moves.
create table fff.extreme_ticks (
  id bigserial primary key,
  user_id uuid not null references fff.profiles (id) on delete cascade,
  extreme_id bigint not null references fff.extremes (id),
  kind text not null check (kind in ('state', 'top100')),
  state text not null,
  rank_at_claim int,
  distance_mi numeric(6, 1) not null,
  log_id bigint references fff.logs (id) on delete set null,
  claimed_at timestamptz not null default now(),
  unique (user_id, extreme_id)
);
-- One State Extreme tick per state per player, however often the state's spot moves.
create unique index extreme_ticks_one_per_state on fff.extreme_ticks (user_id, state) where kind = 'state';

-- Push messages waiting to go out (drained by the push-dispatch Edge Function).
create table fff.outbox (
  id bigserial primary key,
  user_id uuid not null references fff.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text
);
create index outbox_pending on fff.outbox (created_at) where sent_at is null;
