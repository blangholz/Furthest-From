-- Dev tools for testers (Decision #35): my_status says whether you're a tester (the app
-- shows its DEV section only then), and testers can reset their own onboarding to run
-- the flow from the start. The reset clears the onboarded flag and the home pin (so the
-- home step works again despite the season lock); scores, ticks and the name stay.

create or replace function fff.my_status()
returns jsonb language sql stable security definer set search_path = fff, extensions, public as $$
  with me as (select * from fff.profiles where id = auth.uid()),
       s as (select * from fff.game_settings limit 1)
  select jsonb_build_object(
    'user_id', me.id,
    'username', me.username,
    'display_name', me.display_name,
    'time_zone', me.time_zone,
    'onboarded', me.onboarded_at is not null,
    'is_tester', coalesce(me.is_tester, false),
    'has_home', me.home_point is not null,
    'home_locked_until', (select ends_at from fff.seasons where id = me.home_season_id),
    'streak', me.streak_count,
    'best_streak', me.best_streak,
    'fries_credits', me.fries_credits,
    'fries_per', s.fries_per_credits,
    'double_credit_streak', s.double_credit_streak,
    'friend_count', (select count(*) from fff_private.friend_ids(me.id)),
    'global_min_friends', s.global_min_friends,
    'ping_local_time', to_char(s.ping_local_time, 'HH24:MI'),
    'open_ping', (select jsonb_build_object('id', d.id, 'opens_at', d.opens_at, 'closes_at', d.closes_at)
                  from fff.ping_deliveries d
                  where d.user_id = me.id and d.status = 'open' and now() between d.opens_at and d.closes_at
                  order by d.opens_at desc limit 1),
    'today_logged', exists (select 1 from fff.ping_deliveries d where d.user_id = me.id
                            and d.local_date = (now() at time zone me.time_zone)::date and d.status = 'logged'),
    'extra_fries', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'earned_at', f.earned_at, 'expires_at', f.expires_at)
                                   order by f.expires_at)
                             from fff.extra_fries f
                             where f.user_id = me.id and f.used_at is null and f.expires_at > now()), '[]'::jsonb),
    'season', (select jsonb_build_object('id', x.id, 'name', x.name, 'ends_at', x.ends_at) from fff_private.season_for(now()) x),
    'season_points', coalesce((select sum(l.points) from fff.logs l
                               where l.user_id = me.id and l.season_id = (fff_private.season_for(now())).id), 0),
    'all_time_points', coalesce((select sum(l.points) from fff.logs l where l.user_id = me.id), 0)
  )
  from me, s
$$;

create or replace function fff.dev_reset_onboarding()
returns void language plpgsql security definer set search_path = fff, extensions, public as $$
declare me fff.profiles;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select * into me from fff.profiles where id = auth.uid();
  if not coalesce(me.is_tester, false) then raise exception 'not_tester' using errcode = '42501'; end if;
  update fff.profiles set onboarded_at = null, home_point = null, home_season_id = null where id = me.id;
end $$;

revoke all on function fff.dev_reset_onboarding() from public, anon;
grant execute on function fff.dev_reset_onboarding() to authenticated;
