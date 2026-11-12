begin;
select plan(17);
\set ana '''00000000-0000-0000-0000-00000000000a'''
\set ben '''00000000-0000-0000-0000-00000000000b'''
\set cy  '''00000000-0000-0000-0000-00000000000c'''

-- Friend requests
select t_as(:cy);
select is(public.request_friend('@ana'), 'requested', 'Cy asks Ana');
select throws_ok($$ select public.request_friend('cyrus') $$, 'P0001', 'cannot_friend_self', 'no self friends');
select throws_ok($$ select public.request_friend('nobody') $$, 'P0001', 'no_such_user', 'unknown user');
select t_as(:ana);
select is((select incoming from public.my_friends() where username = 'cyrus'), true, 'Ana sees an incoming request');
select is(public.request_friend('cyrus'), 'accepted', 'asking back accepts');
-- Invites
select t_as(:ben);
create temporary table inv as select public.create_invite() as code;
select is((select length(code) from inv), 8, 'invite code made');
select is(public.create_invite(), (select code from inv), 'same code reused');
select t_as(:cy);
select is((public.accept_invite((select code from inv)) ->> 'status'), 'accepted', 'invite makes friends');
select t_admin();
select is((select count(*)::int from public.friendships where status = 'accepted'), 3, 'three friendships');

-- Global board needs 3 friends: give Ana a third friend
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'dee@example.com');
insert into public.friendships values (least(:ana::uuid, '00000000-0000-0000-0000-00000000000d'::uuid),
  greatest(:ana::uuid, '00000000-0000-0000-0000-00000000000d'::uuid), :ana, 'accepted', now(), now());
select t_as(:ana);
select is((select count(*)::int from public.leaderboard('global', 'all') where is_me), 1, 'Ana with 3 friends is on the global board');
select t_admin();

-- Streak derivation: scored counts, home pauses, miss breaks
insert into public.logs (id, user_id, kind, zone, distance_mi, season_id, logged_at) values
  (9001, :ben, 'ping', 'scoring', 10, (private.season_for(now())).id, now() - interval '1 day'),
  (9002, :ben, 'ping', 'home', 0, (private.season_for(now())).id, now() - interval '2 days'),
  (9003, :ben, 'ping', 'passport', 300, (private.season_for(now())).id, now() - interval '3 days'),
  (9004, :ben, 'ping', 'scoring', 20, (private.season_for(now())).id, now() - interval '5 days');
insert into public.ping_deliveries (user_id, local_date, time_zone, opens_at, closes_at, status, log_id) values
  (:ben, current_date - 1, 'UTC', now() - interval '1 day', now() - interval '23 hours', 'logged', 9001),
  (:ben, current_date - 2, 'UTC', now() - interval '2 days', now() - interval '47 hours', 'logged', 9002),
  (:ben, current_date - 3, 'UTC', now() - interval '3 days', now() - interval '71 hours', 'logged', 9003),
  (:ben, current_date - 4, 'UTC', now() - interval '4 days', now() - interval '95 hours', 'missed', null),
  (:ben, current_date - 5, 'UTC', now() - interval '5 days', now() - interval '119 hours', 'logged', 9004);
select is(private.recompute_streak(:ben), 2, 'scored + passport count, home pauses, miss stops');

-- Double credit at a 12+ streak
select t_ping_now();
update public.profiles set fries_credits = 5, streak_count = 0 where id = :ben;
update public.profiles set home_point = null where id = :ben;
insert into public.ping_deliveries (user_id, local_date, time_zone, opens_at, closes_at, status, log_id)
select :ben, current_date - 6 - g, 'UTC', now() - (6 + g) * interval '1 day', now() - (6 + g) * interval '1 day' + interval '1 hour', 'logged', null
from generate_series(0, 15) g;
delete from public.ping_deliveries where user_id = :ben and local_date in (current_date - 4);
select private.schedule_pings();
select t_as(:ben);
create temporary table r as select public.submit_log(39.4935, -117.0669, 'ping') as r;
select t_admin();
select ok((select (r ->> 'streak')::int >= 12 from r), 'long streak');
select is((select fries_credits from public.profiles where id = :ben), 0, '5 + 2 credits = one Extra Fries, none left');

-- Monthly refresh: a spot that moves under 2 mi keeps its id and ticks; one that moves far is retired
insert into public.extreme_ticks (user_id, extreme_id, kind, state, distance_mi)
select :ben, id, kind, state, distance_mi from public.extremes where kind = 'top100' and rank = 2;
create temporary table before as select id, rank from public.extremes where kind = 'top100';
select private.begin_import('refresh test');
insert into private.stage_spots (kind, state, rank, lat, lon, distance_mi) values
  ('top100', 'NV', 1, 37.93, -116.32, 119.9),      -- moved ~0.3 mi
  ('top100', 'NV', 2, 40.5, -117.5, 101.0);        -- the old #2 is gone; new spot far away
select private.finish_import((select max(id) from public.data_versions));
select is((select id from public.extremes where kind = 'top100' and rank = 1 and active),
          (select id from before where rank = 1), 'nearby spot keeps its id');
select isnt((select id from public.extremes where kind = 'top100' and rank = 2 and active),
          (select id from before where rank = 2), 'far move makes a new spot');
select is((select count(*)::int from public.extreme_ticks where user_id = :ben), 1, 'old tick survives the refresh');
select is((select count(*)::int from public.extremes where kind = 'state' and active), 1, 'state spots untouched when not in the import');

select * from finish();
rollback;
