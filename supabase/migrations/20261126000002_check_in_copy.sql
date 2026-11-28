-- Player-facing copy: the daily ping is a "check-in" now (Decision #37).
-- Same as 20261126000001_test_pings.sql, with only the push title and body changed.
-- Table and function names keep "ping"; only the words players see change.
set search_path = fff, extensions, public;

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
    select user_id, '🍟 Check-in time!', 'How far from fries are you? You have an hour to check in.',
           jsonb_build_object('type', 'ping', 'closes_at', closes_at)
    from ins
    returning 1
  )
  select count(*) into n from sent;
  return n;
end $$;
