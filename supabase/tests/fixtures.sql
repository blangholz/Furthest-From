-- Small test world: three US states (two in the lower 48), Iceland, a few stores, one spot of each kind.
insert into public.regions (code, name, kind, lower48, geom) values
 ('US-NV', 'Nevada', 'us_state', true,  st_multi(st_makeenvelope(-120.0, 35.0, -114.0, 42.0, 4326))),
 ('US-CA', 'California', 'us_state', true, st_multi(st_makeenvelope(-125.0, 32.5, -120.0, 42.0, 4326))),
 ('US-AK', 'Alaska', 'us_state', false, st_multi(st_makeenvelope(-170.0, 54.0, -141.0, 71.5, 4326))),
 ('IS', 'Iceland', 'country', false, st_multi(st_makeenvelope(-24.6, 63.3, -13.4, 66.6, 4326)));

select private.begin_import('test fixtures');
insert into private.stage_stores (source_id, lat, lon, country, state, city) values
 ('reno', 39.5296, -119.8138, 'US', 'NV', 'Reno'),
 ('pahrump', 36.2083, -115.9839, 'US', 'NV', 'Pahrump'),
 ('ely', 39.2533, -114.8742, 'US', 'NV', 'Ely'),
 ('fairbanks', 64.8378, -147.7164, 'US', 'AK', 'Fairbanks'),
 ('dublin', 53.3498, -6.2603, 'IE', null, 'Dublin');
insert into private.stage_spots (kind, state, rank, lat, lon, distance_mi, land, nearest) values
 ('state', 'NV', null, 37.92599, -116.31842, 119.8, 'Tonopah Field Office (BLM, OA)', 'Pahrump NV'),
 ('top100', 'NV', 1, 37.92599, -116.31842, 119.8, 'Tonopah Field Office (BLM, OA)', 'Pahrump NV'),
 ('top100', 'NV', 2, 41.91009, -119.55926, 114.7, 'Applegate Field Office (BLM, OA)', 'Winnemucca NV');
select private.finish_import((select max(id) from public.data_versions));

-- Players: Ana and Ben are friends; Cy is a stranger.
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name":"Ana"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ben@example.com', '{"full_name":"Ben"}'),
 ('00000000-0000-0000-0000-00000000000c', 'cy@example.com', '{"full_name":"Cy"}');
update public.profiles set username = 'ana', onboarded_at = now() where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'ben', onboarded_at = now() where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'cyrus' where id = '00000000-0000-0000-0000-00000000000c';
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
 ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000a', 'accepted', now());

-- Test helpers (test database only).
create or replace function public.t_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user::text, true), set_config('role', 'authenticated', true)
$$;
create or replace function public.t_admin() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claim.sub', '', true)
$$;
grant execute on function public.t_as(uuid), public.t_admin() to authenticated;
-- Put "now" inside the ping window: ping opens 10 minutes ago in UTC (or UTC+6 near midnight).
create or replace function public.t_ping_now() returns text language plpgsql as $$
declare tz text := case when extract(hour from now() at time zone 'UTC') in (0, 23) then 'Etc/GMT-6' else 'UTC' end;
begin
  update public.game_settings set ping_local_time = date_trunc('minute', (now() at time zone tz)::time) - interval '10 minutes';
  update public.profiles set time_zone = tz;
  return tz;
end $$;
