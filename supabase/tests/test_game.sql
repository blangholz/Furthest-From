begin;
select plan(48);

-- ids
\set ana '''00000000-0000-0000-0000-00000000000a'''
\set ben '''00000000-0000-0000-0000-00000000000b'''
\set cy  '''00000000-0000-0000-0000-00000000000c'''

-- Privacy by construction: no table that holds player activity has a geography column.
select is((select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name in ('logs', 'ping_deliveries', 'extra_fries', 'extreme_ticks', 'outbox')
             and udt_name in ('geography', 'geometry')), 0, 'activity tables store no coordinates');

-- Seasons
select is((private.season_for('2026-11-12 12:00-08')).name, 'Fall 2026', 'November is Fall');
select is((private.season_for('2027-01-05 12:00-08')).name, 'Winter 2026-27', 'January is the winter that started in December');
select is((private.season_for('2026-12-01 00:30-08')).name, 'Winter 2026-27', 'season turns at Pacific midnight');

-- Ping scheduling
select t_ping_now();
select is(private.schedule_pings(), 2, 'two onboarded players get a ping');
select is(private.schedule_pings(), 0, 'scheduling again is a no-op');
select is((select count(*)::int from public.ping_deliveries where user_id = :cy), 0, 'not-onboarded player gets no ping');
select is((select count(*)::int from public.outbox where data ->> 'type' = 'ping'), 2, 'ping push queued');
select ok((select bool_and(closes_at - opens_at = interval '1 hour') from public.ping_deliveries), 'window is one hour');

-- Ana logs from Austin, NV (central Nevada, far from fries)
select t_as(:ana);
select is((select status from public.ping_deliveries where user_id = :ana), 'open', 'Ana sees her open ping');
create temporary table r1 as select public.submit_log(39.4935, -117.0669, 'ping') as r;
select t_admin();
select is((select r ->> 'zone' from r1), 'scoring', 'Austin NV scores');
select is((select r ->> 'region_code' from r1), 'US-NV', 'region is Nevada');
select ok((select (r ->> 'distance_mi')::numeric between 90 and 140 from r1), 'distance is plausible (Ely is nearest)');
select is((select r ->> 'streak' from r1), '1', 'streak starts at 1');
select is((select status from public.ping_deliveries where user_id = :ana), 'logged', 'delivery marked logged');
select is((select count(*)::int from public.outbox where user_id = :ben and body like 'Ana is % miles from the nearest McDonald''s.'), 1, 'Ben is told Ana''s distance');
select is((select count(*)::int from public.outbox where user_id = :cy and data ->> 'type' = 'log'), 0, 'stranger is not told');

select t_as(:ana);
select throws_ok($$ select public.submit_log(39.4935, -117.0669, 'ping') $$, 'P0001', 'no_open_ping', 'one log per ping');
select t_admin();

-- Ben sets home in Reno and checks in from home
select t_as(:ben);
select lives_ok($$ select public.set_home(39.53, -119.81) $$, 'Ben sets home');
select throws_ok($$ select public.set_home(39.0, -119.0) $$, 'P0001', 'home_locked', 'home locks for the season');
create temporary table r2 as select public.submit_log(39.55, -119.80, 'ping') as r;
select t_admin();
select is((select r ->> 'zone' from r2), 'home', 'Reno log is a home check-in');
select is((select (r ->> 'points')::numeric from r2), 0::numeric, 'home scores zero');
select is((select count(*)::int from public.outbox where user_id = :ana and data ->> 'type' = 'log'), 0, 'home check-ins are not broadcast');

-- RLS: Ben cannot read Ana's logs or anyone's home pin
select t_as(:ben);
select is((select count(*)::int from public.logs), 1, 'Ben sees only his own log rows');
select throws_ok($$ select home_point from public.profiles $$, '42501', null, 'home_point is not readable directly');
select throws_ok($$ select * from public.outbox $$, '42501', null, 'outbox is not readable');
select throws_ok($$ insert into public.logs (user_id, kind, zone, distance_mi, season_id, logged_at) values (auth.uid(), 'ping', 'scoring', 999, 1, now()) $$, '42501', null, 'players cannot write logs directly');
select throws_ok($$ select private.schedule_pings() $$, '42501', null, 'private functions are off limits');
select ok((select (public.my_home() ->> 'lat')::float between 39.5 and 39.6), 'Ben can read his own home');
-- Feed: Ben sees Ana's scored log without a place, and his own home check-in
select is((select count(*)::int from public.feed() where display_name = 'Ana' and region_name is null), 1, 'friend log shown without a place');
select is((select count(*)::int from public.feed() where zone = 'home'), 1, 'own home check-in visible to self');
select t_as(:ana);
select is((select count(*)::int from public.feed() where zone = 'home'), 0, 'friend home check-ins hidden');
select is((select count(*)::int from public.leaderboard('friends', 'season')), 2, 'friends board has both');
select is((select display_name from public.leaderboard('friends', 'season') where rank = 1), 'Ana', 'Ana leads');
select is((select count(*)::int from public.leaderboard('global', 'season')), 0, 'global needs 3 friends');
select t_admin();

-- Extra Fries: earn at 7 credits, spend for a Passport log in Iceland
update public.profiles set fries_credits = 6 where id = :ana;
update public.ping_deliveries set status = 'open', log_id = null where user_id = :ana;
delete from public.logs where user_id = :ana;
select t_as(:ana);
create temporary table r3 as select public.submit_log(39.4935, -117.0669, 'ping') as r;
select t_admin();
select is((select r ->> 'extra_fries_earned' from r3), '1', 'seventh qualifying ping earns Extra Fries');
select is((select count(*)::int from public.extra_fries where user_id = :ana and used_at is null
           and expires_at = earned_at + interval '14 days'), 1, 'Extra Fries expire in 2 weeks');
select t_as(:ana);
create temporary table r4 as select public.submit_log(64.1466, -21.9426, 'extra_fries') as r;
select t_admin();
select is((select r ->> 'zone' from r4), 'passport', 'Iceland is a Passport stamp');
select is((select r ->> 'region_name' from r4), 'Iceland', 'stamp names the country');
select t_as(:ana);
select throws_ok($$ select public.submit_log(64.1, -21.9, 'extra_fries') $$, 'P0001', 'no_extra_fries', 'cannot spend what you do not have');
-- State Extreme claim
select throws_ok(format($$ select public.submit_log(37.93, -116.31842, 'extreme', null, %s) $$,
  (select id from public.spots() where kind = 'state' and state = 'NV')), 'P0001', 'too_far', 'must be within 150 ft');
select lives_ok(format($$ select public.submit_log(37.92620, -116.31842, 'extreme', null, %s) $$,
  (select id from public.spots() where kind = 'state' and state = 'NV')), 'claim within 150 ft works');
select throws_ok(format($$ select public.submit_log(37.92599, -116.31842, 'extreme', null, %s) $$,
  (select id from public.spots() where kind = 'state' and state = 'NV')), 'P0001', 'already_claimed', 'claim once per player');
select is((select count(*)::int from public.spots() where claimed), 1, 'spots() shows the tick');
select t_admin();
select is((select count(*)::int from public.outbox where user_id = :ben and body like 'Ana reached Nevada''s furthest point%'), 1, 'friends hear about the claim');

-- Missed pings break streaks; a queued offline upload repairs it
update public.ping_deliveries set opens_at = now() - interval '3 hours', closes_at = now() - interval '2 hours',
  status = 'open', log_id = null where user_id = :ana;
delete from public.logs where user_id = :ana and kind = 'ping';
update public.profiles set streak_count = 5 where id = :ana;
select is(private.close_ping_windows(), 1, 'closed Ana''s open window');
select is((select streak_count from public.profiles where id = :ana), 0, 'missed ping breaks the streak');
select t_as(:ana);
select lives_ok($$ select public.submit_log(39.4935, -117.0669, 'ping', now() - interval '150 minutes') $$, 'late upload of a log made in the window is accepted');
select t_admin();

select * from finish();
rollback;
