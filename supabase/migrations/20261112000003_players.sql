-- Far From Fries: profile, home pin, friends, invites, feed, leaderboards, status.

-- ---------------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------------
create or replace function public.update_profile(p_username text default null, p_display_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_username is not null then
    if lower(p_username) !~ '^[a-z0-9_]{3,20}$' then raise exception 'bad_username' using errcode = '22023'; end if;
    if exists (select 1 from public.profiles where username = lower(p_username) and id <> uid) then
      raise exception 'username_taken' using errcode = 'P0001';
    end if;
    update public.profiles set username = lower(p_username) where id = uid;
  end if;
  if p_display_name is not null then
    update public.profiles set display_name = left(trim(p_display_name), 40) where id = uid;
  end if;
end $$;

-- The phone reports its current time zone on every launch; the daily ping follows it.
create or replace function public.set_time_zone(p_time_zone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_time_zone) then
    raise exception 'bad_time_zone' using errcode = '22023';
  end if;
  update public.profiles set time_zone = p_time_zone where id = auth.uid();
end $$;

-- Home pin: settable once per season, then locked until the next season starts.
create or replace function public.set_home(p_lat double precision, p_lon double precision)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); me public.profiles; cur public.seasons := private.season_for(now());
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select * into me from public.profiles where id = uid for update;
  if me.home_point is not null and me.home_season_id = cur.id then
    raise exception 'home_locked' using errcode = 'P0001', detail = cur.ends_at::text;
  end if;
  update public.profiles set home_point = private.point(p_lat, p_lon), home_season_id = cur.id where id = uid;
  return jsonb_build_object('locked_until', cur.ends_at, 'season', cur.name);
end $$;

-- Your own home pin, for your own map. Nobody else can read it.
create or replace function public.my_home()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select case when home_point is null then null else jsonb_build_object(
    'lat', st_y(home_point::geometry), 'lon', st_x(home_point::geometry),
    'locked_until', (select ends_at from public.seasons where id = home_season_id)) end
  from public.profiles where id = auth.uid()
$$;

create or replace function public.complete_onboarding()
returns void language sql security definer set search_path = public as $$
  update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = auth.uid()
$$;

create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

-- App Store rule: accounts must be deletable from inside the app.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Everything the home screen needs in one call.
create or replace function public.my_status()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  with me as (select * from public.profiles where id = auth.uid()),
       s as (select * from public.game_settings limit 1)
  select jsonb_build_object(
    'user_id', me.id,
    'username', me.username,
    'display_name', me.display_name,
    'time_zone', me.time_zone,
    'onboarded', me.onboarded_at is not null,
    'has_home', me.home_point is not null,
    'home_locked_until', (select ends_at from public.seasons where id = me.home_season_id),
    'streak', me.streak_count,
    'best_streak', me.best_streak,
    'fries_credits', me.fries_credits,
    'fries_per', s.fries_per_credits,
    'double_credit_streak', s.double_credit_streak,
    'friend_count', (select count(*) from private.friend_ids(me.id)),
    'global_min_friends', s.global_min_friends,
    'ping_local_time', to_char(s.ping_local_time, 'HH24:MI'),
    'open_ping', (select jsonb_build_object('id', d.id, 'opens_at', d.opens_at, 'closes_at', d.closes_at)
                  from public.ping_deliveries d
                  where d.user_id = me.id and d.status = 'open' and now() between d.opens_at and d.closes_at
                  order by d.opens_at desc limit 1),
    'today_logged', exists (select 1 from public.ping_deliveries d where d.user_id = me.id
                            and d.local_date = (now() at time zone me.time_zone)::date and d.status = 'logged'),
    'extra_fries', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'earned_at', f.earned_at, 'expires_at', f.expires_at)
                                   order by f.expires_at)
                             from public.extra_fries f
                             where f.user_id = me.id and f.used_at is null and f.expires_at > now()), '[]'::jsonb),
    'season', (select jsonb_build_object('id', x.id, 'name', x.name, 'ends_at', x.ends_at) from private.season_for(now()) x),
    'season_points', coalesce((select sum(l.points) from public.logs l
                               where l.user_id = me.id and l.season_id = (private.season_for(now())).id), 0),
    'all_time_points', coalesce((select sum(l.points) from public.logs l where l.user_id = me.id), 0)
  )
  from me, s
$$;

-- ---------------------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------------------
create or replace function private.pair(a uuid, b uuid, out lo uuid, out hi uuid)
language sql immutable as $$ select least(a, b), greatest(a, b) $$;

create or replace function public.request_friend(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); other uuid; p record; f public.friendships;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select id into other from public.profiles where username = lower(trim(leading '@' from p_username));
  if other is null then raise exception 'no_such_user' using errcode = 'P0001'; end if;
  if other = uid then raise exception 'cannot_friend_self' using errcode = 'P0001'; end if;
  select * into p from private.pair(uid, other);
  select * into f from public.friendships where user_a = p.lo and user_b = p.hi for update;
  if f.user_a is null then
    insert into public.friendships (user_a, user_b, requested_by) values (p.lo, p.hi, uid);
    perform private.notify(other, '🍟 Friend request',
      private.player_name(uid) || ' wants to be friends on Far From Fries.', jsonb_build_object('type', 'friend_request'));
    return 'requested';
  elsif f.status = 'pending' and f.requested_by <> uid then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = p.lo and user_b = p.hi;
    perform private.notify(other, '🍟 New friend',
      private.player_name(uid) || ' accepted your friend request.', jsonb_build_object('type', 'friend_accepted'));
    return 'accepted';
  end if;
  return f.status;
end $$;

create or replace function public.respond_friend(p_other uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p record;
begin
  select * into p from private.pair(uid, p_other);
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
    where user_a = p.lo and user_b = p.hi and status = 'pending' and requested_by <> uid;
    if found then
      perform private.notify(p_other, '🍟 New friend',
        private.player_name(uid) || ' accepted your friend request.', jsonb_build_object('type', 'friend_accepted'));
    end if;
  else
    delete from public.friendships where user_a = p.lo and user_b = p.hi and status = 'pending';
  end if;
end $$;

create or replace function public.remove_friend(p_other uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friendships
  where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other)
$$;

create or replace function public.my_friends()
returns table (user_id uuid, username text, display_name text, status text, incoming boolean,
               streak int, season_points numeric)
language sql stable security definer set search_path = public as $$
  select o.id, o.username, o.display_name, f.status,
         (f.status = 'pending' and f.requested_by <> auth.uid()),
         case when f.status = 'accepted' then o.streak_count end,
         case when f.status = 'accepted' then
           coalesce((select sum(l.points) from public.logs l
                     where l.user_id = o.id and l.season_id = (private.season_for(now())).id), 0) end
  from public.friendships f
  join public.profiles o on o.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b)
  order by f.status, o.display_name
$$;

-- Invite links: https://<web>/i/<code> opens the app and calls accept_invite.
create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select code into c from public.invites where inviter = auth.uid() order by created_at desc limit 1;
  if c is not null then return c; end if;
  loop
    c := lower(substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'xyz'), 1, 8));
    begin
      insert into public.invites (code, inviter) values (c, auth.uid());
      return c;
    exception when unique_violation then -- try another code
    end;
  end loop;
end $$;

create or replace function public.accept_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); inv public.invites; p record;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select * into inv from public.invites where code = lower(p_code);
  if inv.code is null then raise exception 'bad_invite' using errcode = 'P0001'; end if;
  if inv.inviter = uid then return jsonb_build_object('status', 'own_invite'); end if;
  select * into p from private.pair(uid, inv.inviter);
  insert into public.friendships (user_a, user_b, requested_by, status, accepted_at)
  values (p.lo, p.hi, inv.inviter, 'accepted', now())
  on conflict (user_a, user_b) do update set status = 'accepted', accepted_at = coalesce(public.friendships.accepted_at, now());
  update public.invites set uses = uses + 1 where code = inv.code;
  perform private.notify(inv.inviter, '🍟 New friend',
    private.player_name(uid) || ' joined from your invite.', jsonb_build_object('type', 'friend_accepted'));
  return jsonb_build_object('status', 'accepted', 'friend', private.player_name(inv.inviter));
end $$;

-- ---------------------------------------------------------------------------
-- Feed: your and your friends' logs and claims. Distances only, never places.
-- Friends' home check-ins are left out. The state or country is shown only on
-- Passport stamps and State Extreme / Top 100 claims, where it is the point.
-- ---------------------------------------------------------------------------
create or replace function public.feed(p_before timestamptz default null, p_limit int default 50)
returns table (log_id bigint, user_id uuid, display_name text, is_me boolean, kind text, zone text,
               distance_mi numeric, points numeric, region_name text, spot_kind text, spot_rank int,
               spot_state text, logged_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.user_id, private.player_name(l.user_id), l.user_id = auth.uid(), l.kind, l.zone,
         l.distance_mi, l.points,
         case when l.zone = 'passport' or l.kind = 'extreme' then l.region_name end,
         e.kind, e.rank, e.state, l.logged_at
  from public.logs l
  left join public.extremes e on e.id = l.extreme_id
  where (l.user_id = auth.uid() or l.user_id in (select private.friend_ids(auth.uid())))
    and (l.zone <> 'home' or l.user_id = auth.uid())
    and l.logged_at < coalesce(p_before, 'infinity')
  order by l.logged_at desc
  limit least(greatest(p_limit, 1), 200)
$$;

-- ---------------------------------------------------------------------------
-- Leaderboards. p_scope: 'friends' (you and your friends) or 'global' (players
-- with at least 3 friends). p_period: 'season' or 'all'.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard(p_scope text default 'friends', p_period text default 'season',
                                              p_limit int default 100)
returns table (rank bigint, user_id uuid, display_name text, points numeric, logs bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with season as (select (private.season_for(now())).id as id),
  players as (
    select p.id from public.profiles p
    where case p_scope
      when 'friends' then p.id = auth.uid() or p.id in (select private.friend_ids(auth.uid()))
      when 'global' then (select count(*) from private.friend_ids(p.id))
                         >= (select global_min_friends from public.game_settings limit 1)
      else false end
  ),
  totals as (
    select pl.id, coalesce(sum(l.points), 0) as points, count(l.id) filter (where l.zone = 'scoring') as logs
    from players pl
    left join public.logs l on l.user_id = pl.id and l.zone = 'scoring'
      and (p_period = 'all' or l.season_id = (select id from season))
    group by pl.id
  ),
  ranked as (
    select rank() over (order by t.points desc) as rank, t.id, private.player_name(t.id) as name,
           t.points, t.logs, t.id = auth.uid() as is_me
    from totals t
  )
  select * from ranked where ranked.rank <= p_limit or ranked.is_me order by ranked.rank, ranked.name
$$;
