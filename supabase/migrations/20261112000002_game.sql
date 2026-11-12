-- Far From Fries: scoring, pings, streaks, Extra Fries, State Extremes and Top 100 claims.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.point(p_lat double precision, p_lon double precision)
returns extensions.geography
language plpgsql immutable set search_path = public, extensions as $$
begin
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'bad_coordinates' using errcode = '22023';
  end if;
  return st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;
end $$;

-- Straight-line (geodesic) distance in miles to the nearest store, or null with no store data.
create or replace function private.nearest_store_mi(p_g extensions.geography)
returns numeric
language sql stable set search_path = public, extensions as $$
  -- The KNN operator orders by sphere distance; check the 5 closest on the spheroid.
  select round((min(st_distance(c.geom, p_g)) / 1609.344)::numeric, 2)
  from (select geom from public.stores order by geom <-> p_g limit 5) c
$$;

-- Which region a point is in. Coastline polygons are generalized, so a point just
-- off a polygon (a beach, a pier) takes the nearest region within 10 km.
create or replace function private.region_at(p_g extensions.geography,
  out code text, out name text, out kind text, out lower48 boolean)
language plpgsql stable set search_path = public, extensions as $$
declare gm extensions.geometry := p_g::geometry;
begin
  select r.code, r.name, r.kind, r.lower48 into code, name, kind, lower48
  from public.regions r where st_intersects(r.geom, gm)
  order by (r.kind = 'us_state') desc limit 1;
  if code is null then
    select r.code, r.name, r.kind, r.lower48 into code, name, kind, lower48
    from public.regions r where st_dwithin(r.geom::geography, p_g, 10000)
    order by (r.kind = 'us_state') desc, st_distance(r.geom::geography, p_g) limit 1;
  end if;
  if code is null and not exists (select 1 from public.regions) then
    -- Region data not loaded yet (fresh dev database): fall back to a rough lower-48 box.
    if st_y(gm) between 24.4 and 49.4 and st_x(gm) between -124.8 and -66.9 then
      code := 'US'; name := 'United States'; kind := 'us_state'; lower48 := true;
    end if;
  end if;
end $$;

-- zone: 'home' inside the player's 5-mile home zone, 'scoring' in the lower 48,
-- 'passport' anywhere else (Alaska, Hawaii, other countries, the ocean).
create or replace function private.classify(p_g extensions.geography, p_home extensions.geography,
  out zone text, out region_code text, out region_name text)
language plpgsql stable set search_path = public, extensions as $$
declare r record; s public.game_settings := private.settings();
begin
  select * into r from private.region_at(p_g);
  region_code := r.code;
  region_name := coalesce(r.name, 'Open water');
  if p_home is not null and st_dwithin(p_home, p_g, s.home_radius_m) then
    zone := 'home';
  elsif coalesce(r.lower48, false) then
    zone := 'scoring';
  else
    zone := 'passport';
  end if;
end $$;

create or replace function private.player_name(p_user uuid) returns text
language sql stable set search_path = public as $$
  select coalesce(nullif(display_name, ''), username, 'A friend') from public.profiles where id = p_user
$$;

create or replace function private.friend_ids(p_user uuid) returns setof uuid
language sql stable set search_path = public as $$
  select case when user_a = p_user then user_b else user_a end
  from public.friendships
  where status = 'accepted' and (user_a = p_user or user_b = p_user)
$$;

create or replace function private.notify(p_user uuid, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql set search_path = public as $$
  insert into public.outbox (user_id, title, body, data) values (p_user, p_title, p_body, p_data)
$$;

create or replace function private.notify_friends(p_user uuid, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql set search_path = public as $$
  insert into public.outbox (user_id, title, body, data)
  select f, p_title, p_body, p_data from private.friend_ids(p_user) f
$$;

create or replace function private.fmt_mi(p numeric) returns text
language sql immutable as $$ select to_char(round(p, 1), 'FM999990.0') $$;

-- ---------------------------------------------------------------------------
-- Streaks. Derived from ping history so a late (queued offline) upload can repair it.
-- Qualifying pings (scored or Passport) add 1, home check-ins pause, a miss breaks.
-- ---------------------------------------------------------------------------
create or replace function private.recompute_streak(p_user uuid) returns int
language plpgsql set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select d.status, l.zone from public.ping_deliveries d
    left join public.logs l on l.id = d.log_id
    where d.user_id = p_user and d.status <> 'open'
    order by d.local_date desc
  loop
    exit when r.status = 'missed';
    if r.zone is distinct from 'home' then n := n + 1; end if;
  end loop;
  update public.profiles set streak_count = n, best_streak = greatest(best_streak, n) where id = p_user;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- The one place exact coordinates are used. Scores a point and returns the result.
-- Nothing about the point is stored: only the distance, zone and state/country.
-- p_kind: 'ping' (inside an open ping window), 'extra_fries' (spends one), or
-- 'extreme' (claims p_extreme_id; must be within 150 ft of it).
-- p_logged_at: when the player opened the app, for logs queued while offline.
-- ---------------------------------------------------------------------------
create or replace function public.submit_log(
  p_lat double precision,
  p_lon double precision,
  p_kind text default 'ping',
  p_logged_at timestamptz default null,
  p_extreme_id bigint default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  s public.game_settings := private.settings();
  g extensions.geography := private.point(p_lat, p_lon);
  t timestamptz := coalesce(p_logged_at, now());
  me public.profiles;
  d public.ping_deliveries;
  fr public.extra_fries;
  ex public.extremes;
  c record;
  dist numeric;
  season public.seasons;
  v_log bigint;
  streak int;
  earned int := 0;
  credits int;
  who text;
  dv int;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_kind not in ('ping', 'extra_fries', 'extreme') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if t > now() + interval '2 minutes' then t := now(); end if;
  if t < now() - s.late_upload_grace then raise exception 'too_late' using errcode = 'P0001'; end if;

  select * into me from public.profiles where id = uid for update;

  if p_kind = 'ping' then
    select * into d from public.ping_deliveries
      where user_id = uid and log_id is null and status in ('open', 'missed')
        and t between opens_at and closes_at
      order by opens_at desc limit 1 for update;
    if d.id is null then raise exception 'no_open_ping' using errcode = 'P0001'; end if;
  elsif p_kind = 'extra_fries' then
    select * into fr from public.extra_fries
      where user_id = uid and used_at is null and expires_at > t and earned_at <= t
      order by expires_at limit 1 for update;
    if fr.id is null then raise exception 'no_extra_fries' using errcode = 'P0001'; end if;
  else
    select * into ex from public.extremes where id = p_extreme_id and active;
    if ex.id is null then raise exception 'no_such_spot' using errcode = 'P0001'; end if;
    if st_distance(ex.geom, g) > s.claim_radius_m then
      raise exception 'too_far' using errcode = 'P0001',
        detail = round((st_distance(ex.geom, g) * 3.28084)::numeric)::text || ' ft';
    end if;
    if exists (select 1 from public.extreme_ticks k where k.user_id = uid
               and ((ex.kind = 'state' and k.kind = 'state' and k.state = ex.state) or k.extreme_id = ex.id)) then
      raise exception 'already_claimed' using errcode = 'P0001';
    end if;
  end if;

  dist := private.nearest_store_mi(g);
  if dist is null then raise exception 'no_store_data' using errcode = 'P0001'; end if;
  select * into c from private.classify(g, me.home_point);
  season := private.season_for(t);
  select max(id) into dv from public.data_versions;

  insert into public.logs (user_id, kind, zone, distance_mi, region_code, region_name, season_id,
                           delivery_id, extreme_id, data_version_id, logged_at)
  values (uid, p_kind, c.zone, dist, c.region_code, c.region_name, season.id,
          d.id, ex.id, dv, t)
  returning id into v_log;
  g := null; -- done with the point

  who := private.player_name(uid);

  if p_kind = 'ping' then
    update public.ping_deliveries set status = 'logged', log_id = v_log where id = d.id;
    streak := private.recompute_streak(uid);
    if c.zone <> 'home' then
      credits := me.fries_credits + case when streak >= s.double_credit_streak then 2 else 1 end;
      while credits >= s.fries_per_credits loop
        insert into public.extra_fries (user_id, earned_at, expires_at, earned_from_log_id)
        values (uid, t, t + s.fries_ttl, v_log);
        credits := credits - s.fries_per_credits;
        earned := earned + 1;
      end loop;
      update public.profiles set fries_credits = credits where id = uid;
    end if;
  else
    streak := me.streak_count;
    if p_kind = 'extra_fries' then
      update public.extra_fries set used_at = now(), used_log_id = v_log where id = fr.id;
    else
      insert into public.extreme_ticks (user_id, extreme_id, kind, state, rank_at_claim, distance_mi, log_id)
      values (uid, ex.id, ex.kind, ex.state, ex.rank, ex.distance_mi, v_log);
    end if;
  end if;

  -- Tell friends. Home check-ins stay quiet so nobody can work out where home is.
  if p_kind = 'extreme' then
    perform private.notify_friends(uid, '🍟 ' || who || ' made it!',
      case when ex.kind = 'state'
        then who || ' reached ' || coalesce((select name from public.regions where code = 'US-' || ex.state), ex.state)
             || '''s furthest point from McDonald''s, ' || private.fmt_mi(ex.distance_mi) || ' miles out.'
        else who || ' reached Top 100 spot #' || ex.rank || ' (' || ex.state || '), '
             || private.fmt_mi(ex.distance_mi) || ' miles from the nearest McDonald''s.'
      end,
      jsonb_build_object('type', 'extreme', 'log_id', v_log));
  elsif c.zone = 'scoring' then
    perform private.notify_friends(uid, '🍟 Far From Fries',
      who || ' is ' || private.fmt_mi(dist) || ' miles from the nearest McDonald''s.',
      jsonb_build_object('type', 'log', 'log_id', v_log));
  elsif c.zone = 'passport' then
    perform private.notify_friends(uid, '🍟 Far From Fries',
      who || ' is ' || private.fmt_mi(dist) || ' miles from the nearest McDonald''s, in ' || c.region_name || '.',
      jsonb_build_object('type', 'log', 'log_id', v_log));
  end if;

  return jsonb_build_object(
    'log_id', v_log, 'kind', p_kind, 'zone', c.zone, 'distance_mi', dist,
    'points', case when c.zone = 'scoring' then dist else 0 end,
    'region_code', c.region_code, 'region_name', c.region_name,
    'season', season.name, 'streak', streak, 'extra_fries_earned', earned,
    'logged_at', t);
end $$;

-- ---------------------------------------------------------------------------
-- Daily ping: every player at 1:20 PM in their own time zone, 1-hour window.
-- Called every minute by pg_cron. Safe to call more often.
-- ---------------------------------------------------------------------------
create or replace function private.schedule_pings(p_now timestamptz default now())
returns int
language plpgsql set search_path = public as $$
declare s public.game_settings := private.settings(); n int;
begin
  with due as (
    select p.id, p.time_zone, (p_now at time zone p.time_zone)::date as local_date
    from public.profiles p
    where p.onboarded_at is not null
      and (p_now at time zone p.time_zone)::time >= s.ping_local_time
      and (p_now at time zone p.time_zone)::time < s.ping_local_time + s.ping_window
  ), ins as (
    insert into public.ping_deliveries (user_id, local_date, time_zone, opens_at, closes_at)
    select id, local_date, time_zone,
           (local_date + s.ping_local_time) at time zone time_zone,
           ((local_date + s.ping_local_time) at time zone time_zone) + s.ping_window
    from due
    on conflict (user_id, local_date) do nothing
    returning user_id, closes_at
  ), sent as (
    insert into public.outbox (user_id, title, body, data)
    select user_id, '🍟 Ping!', 'How far from fries are you? You have an hour to log it.',
           jsonb_build_object('type', 'ping', 'closes_at', closes_at)
    from ins
    returning 1
  )
  select count(*) into n from sent;
  return n;
end $$;

create or replace function private.close_ping_windows(p_now timestamptz default now())
returns int
language plpgsql set search_path = public as $$
declare u uuid; n int := 0;
begin
  for u in
    with closed as (
      update public.ping_deliveries set status = 'missed'
      where status = 'open' and closes_at < p_now
      returning user_id
    ) select distinct user_id from closed
  loop
    perform private.recompute_streak(u);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function private.warn_expiring_fries(p_now timestamptz default now())
returns int
language plpgsql set search_path = public as $$
declare s public.game_settings := private.settings(); n int;
begin
  with w as (
    update public.extra_fries set warned_at = p_now
    where used_at is null and warned_at is null
      and expires_at > p_now and expires_at <= p_now + s.fries_warn_before
    returning user_id, expires_at
  ), o as (
    insert into public.outbox (user_id, title, body, data)
    select user_id, '🍟 Extra Fries expiring',
           'You have Extra Fries that expire soon. Use them somewhere far out.',
           jsonb_build_object('type', 'fries_expiring', 'expires_at', expires_at)
    from w returning 1
  ) select count(*) into n from o;
  return n;
end $$;

create or replace function private.run_minutely() returns void
language plpgsql set search_path = public as $$
begin
  perform private.close_ping_windows();
  perform private.schedule_pings();
  perform private.warn_expiring_fries();
end $$;
