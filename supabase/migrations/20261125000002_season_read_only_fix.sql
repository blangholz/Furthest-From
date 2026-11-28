-- Fix: the app's status call failed with "cannot execute INSERT in a read-only transaction".
--
-- fff.my_status, fff.leaderboard and other `stable` RPCs call fff_private.season_for(now()).
-- PostgREST runs stable functions in a read-only transaction, but season_for always ran
-- `insert ... on conflict do nothing`, so every such API call failed and the app sat on a
-- blank screen waiting for its status.
--
-- 1. season_for only inserts when the season row is missing (a plain lookup otherwise).
-- 2. An hourly job creates the current season and the one 2 days ahead, so the row
--    already exists before any read-only call needs it (including at a season boundary).
-- 3. Create them now.
set search_path = fff, extensions, public;

create or replace function fff_private.season_for(p_ts timestamptz)
returns fff.seasons
language plpgsql set search_path = fff, extensions, public as $$
declare
  tz text := (fff_private.settings()).season_time_zone;
  loc timestamp := p_ts at time zone tz;
  m int := extract(month from loc);
  y int := extract(year from loc);
  sm int; sy int; nm text; st timestamptz; s fff.seasons;
begin
  if m in (3,4,5) then sm := 3; sy := y; nm := 'Spring ' || y;
  elsif m in (6,7,8) then sm := 6; sy := y; nm := 'Summer ' || y;
  elsif m in (9,10,11) then sm := 9; sy := y; nm := 'Fall ' || y;
  elsif m = 12 then sm := 12; sy := y; nm := 'Winter ' || y || '-' || right((y + 1)::text, 2);
  else sm := 12; sy := y - 1; nm := 'Winter ' || (y - 1) || '-' || right(y::text, 2);
  end if;
  st := make_timestamp(sy, sm, 1, 0, 0, 0) at time zone tz;

  select * into s from fff.seasons where starts_at = st;
  if found then
    return s;
  end if;

  insert into fff.seasons (name, starts_at, ends_at)
  values (nm, st, (make_timestamp(sy, sm, 1, 0, 0, 0) + interval '3 months') at time zone tz)
  on conflict (starts_at) do nothing;
  select * into s from fff.seasons where starts_at = st;
  return s;
end $$;

create or replace function fff_private.ensure_seasons()
returns void language plpgsql set search_path = fff, extensions, public as $$
begin
  perform fff_private.season_for(now());
  perform fff_private.season_for(now() + interval '2 days');
end $$;

select fff_private.ensure_seasons();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ff-seasons', '7 * * * *', 'select fff_private.ensure_seasons()');
  end if;
end $$;
