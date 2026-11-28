-- Test pings: let a tester open a ping on demand ("Ping me in 5 seconds" on the Me tab,
-- shown only in development builds) to try the check-in flow without waiting for 1:20 PM.
--
-- - ping_deliveries.is_test marks them. The one-ping-per-day rule now applies only to
--   real pings, so a test never blocks (or is blocked by) the day's real ping.
-- - Streaks ignore test pings, so a missed test can't break a real streak.
-- - Logs made during a test ping score like normal logs (they show on the leaderboard).
-- - Only profiles with is_tester = true may open one. Set it by hand:
--     update fff.profiles set is_tester = true where id = '<user id>';
set search_path = fff, extensions, public;

alter table fff.ping_deliveries add column if not exists is_test boolean not null default false;
alter table fff.ping_deliveries drop constraint if exists ping_deliveries_user_id_local_date_key;
create unique index if not exists ping_deliveries_one_real_per_day
  on fff.ping_deliveries (user_id, local_date) where not is_test;

alter table fff.profiles add column if not exists is_tester boolean not null default false;

-- Same as 20261112000002_game.sql, with the conflict target matching the partial index.
create or replace function fff_private.schedule_pings(p_now timestamptz default now())
returns int
language plpgsql set search_path = fff, extensions, public as $$
declare s fff.game_settings := fff_private.settings(); n int;
begin
  with due as (
    select p.id, p.time_zone, (p_now at time zone p.time_zone)::date as local_date
    from fff.profiles p
    where p.onboarded_at is not null
      and (p_now at time zone p.time_zone)::time >= s.ping_local_time
      and (p_now at time zone p.time_zone)::time < s.ping_local_time + s.ping_window
  ), ins as (
    insert into fff.ping_deliveries (user_id, local_date, time_zone, opens_at, closes_at)
    select id, local_date, time_zone,
           (local_date + s.ping_local_time) at time zone time_zone,
           ((local_date + s.ping_local_time) at time zone time_zone) + s.ping_window
    from due
    on conflict (user_id, local_date) where not is_test do nothing
    returning user_id, closes_at
  ), sent as (
    insert into fff.outbox (user_id, title, body, data)
    select user_id, '🍟 Ping!', 'How far from fries are you? You have an hour to log it.',
           jsonb_build_object('type', 'ping', 'closes_at', closes_at)
    from ins
    returning 1
  )
  select count(*) into n from sent;
  return n;
end $$;

-- Same as 20261112000002_game.sql, minus test pings.
create or replace function fff_private.recompute_streak(p_user uuid) returns int
language plpgsql set search_path = fff, extensions, public as $$
declare r record; n int := 0;
begin
  for r in
    select d.status, l.zone from fff.ping_deliveries d
    left join fff.logs l on l.id = d.log_id
    where d.user_id = p_user and d.status <> 'open' and not d.is_test
    order by d.local_date desc
  loop
    exit when r.status = 'missed';
    if r.zone is distinct from 'home' then n := n + 1; end if;
  end loop;
  update fff.profiles set streak_count = n, best_streak = greatest(best_streak, n) where id = p_user;
  return n;
end $$;

create or replace function fff.open_test_ping(p_delay_seconds int default 5)
returns jsonb
language plpgsql security definer set search_path = fff, extensions, public as $$
declare
  uid uuid := auth.uid();
  me fff.profiles;
  s fff.game_settings := fff_private.settings();
  d fff.ping_deliveries;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select * into me from fff.profiles where id = uid;
  if not coalesce(me.is_tester, false) then raise exception 'not_tester' using errcode = '42501'; end if;

  -- One test ping at a time: drop earlier ones that were never logged.
  delete from fff.ping_deliveries where user_id = uid and is_test and log_id is null;

  insert into fff.ping_deliveries (user_id, local_date, time_zone, opens_at, closes_at, is_test)
  values (uid, (now() at time zone me.time_zone)::date, me.time_zone,
          now() + make_interval(secs => greatest(0, least(p_delay_seconds, 600))),
          now() + make_interval(secs => greatest(0, least(p_delay_seconds, 600))) + s.ping_window,
          true)
  returning * into d;

  return jsonb_build_object('id', d.id, 'opens_at', d.opens_at, 'closes_at', d.closes_at);
end $$;

revoke all on function fff.open_test_ping(int) from public, anon;
grant execute on function fff.open_test_ping(int) to authenticated;
