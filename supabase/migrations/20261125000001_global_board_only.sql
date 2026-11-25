-- First release ships with one global leaderboard and no friends (Decisions Log #26).
-- Friendships, invites and the feed stay in the schema, untouched, for when friends return.
--
-- 1. No friend minimum for the global board. Set back to 3 to bring the gate back.
-- 2. The global board lists only players who have scored in the period (plus you),
--    so it isn't padded with everyone who has opened the app.

update fff.game_settings set global_min_friends = 0;
alter table fff.game_settings alter column global_min_friends set default 0;

-- Same as 20261112000003_players.sql, plus the "has scored" filter on the global board.
-- create or replace keeps the existing grants.
create or replace function fff.leaderboard(p_scope text default 'friends', p_period text default 'season',
                                              p_limit int default 100)
returns table (rank bigint, user_id uuid, display_name text, points numeric, logs bigint, is_me boolean)
language sql stable security definer set search_path = fff, extensions, public as $$
  with season as (select (fff_private.season_for(now())).id as id),
  players as (
    select p.id from fff.profiles p
    where case p_scope
      when 'friends' then p.id = auth.uid() or p.id in (select fff_private.friend_ids(auth.uid()))
      when 'global' then (select count(*) from fff_private.friend_ids(p.id))
                         >= (select global_min_friends from fff.game_settings limit 1)
      else false end
  ),
  totals as (
    select pl.id, coalesce(sum(l.points), 0) as points, count(l.id) filter (where l.zone = 'scoring') as logs
    from players pl
    left join fff.logs l on l.user_id = pl.id and l.zone = 'scoring'
      and (p_period = 'all' or l.season_id = (select id from season))
    group by pl.id
    having p_scope <> 'global' or count(l.id) > 0 or pl.id = auth.uid()
  ),
  ranked as (
    select rank() over (order by t.points desc) as rank, t.id, fff_private.player_name(t.id) as name,
           t.points, t.logs, t.id = auth.uid() as is_me
    from totals t
  )
  select * from ranked where ranked.rank <= p_limit or ranked.is_me order by ranked.rank, ranked.name
$$;
