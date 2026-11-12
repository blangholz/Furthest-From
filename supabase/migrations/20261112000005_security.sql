-- Far From Fries: row-level security and grants.
set search_path = fff, extensions, public;
-- Players read only their own rows directly. Anything about friends comes through
-- security-definer functions that return distances, never coordinates.

alter table fff.game_settings enable row level security;
alter table fff.seasons enable row level security;
alter table fff.profiles enable row level security;
alter table fff.friendships enable row level security;
alter table fff.invites enable row level security;
alter table fff.push_tokens enable row level security;
alter table fff.data_versions enable row level security;
alter table fff.stores enable row level security;
alter table fff.regions enable row level security;
alter table fff.extremes enable row level security;
alter table fff.ping_deliveries enable row level security;
alter table fff.logs enable row level security;
alter table fff.extra_fries enable row level security;
alter table fff.extreme_ticks enable row level security;
alter table fff.outbox enable row level security;

-- Only the fff schemas are touched here, never public.
grant usage on schema fff to authenticated, service_role;

-- Start from nothing, then grant reads only.
revoke all on all tables in schema fff from anon, authenticated;
revoke all on all sequences in schema fff from anon, authenticated;

grant select on fff.game_settings, fff.seasons, fff.data_versions, fff.stores
  to authenticated;
grant select on fff.logs, fff.ping_deliveries, fff.extra_fries, fff.extreme_ticks,
  fff.friendships, fff.invites to authenticated;
-- Profiles: everything except the home pin. home_point is only reachable through my_home().
grant select (id, username, display_name, time_zone, home_season_id, streak_count, best_streak,
              fries_credits, onboarded_at, created_at) on fff.profiles to authenticated;

create policy "settings readable" on fff.game_settings for select to authenticated using (true);
create policy "seasons readable" on fff.seasons for select to authenticated using (true);
create policy "data versions readable" on fff.data_versions for select to authenticated using (true);
create policy "stores readable" on fff.stores for select to authenticated using (true);
create policy "own profile" on fff.profiles for select to authenticated using (id = auth.uid());
create policy "own logs" on fff.logs for select to authenticated using (user_id = auth.uid());
create policy "own pings" on fff.ping_deliveries for select to authenticated using (user_id = auth.uid());
create policy "own fries" on fff.extra_fries for select to authenticated using (user_id = auth.uid());
create policy "own ticks" on fff.extreme_ticks for select to authenticated using (user_id = auth.uid());
create policy "own friendships" on fff.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy "own invites" on fff.invites for select to authenticated using (inviter = auth.uid());
-- regions, extremes, push_tokens, outbox: no direct access (spots() lists extremes).

-- Functions: Postgres grants EXECUTE to PUBLIC by default, so revoke and re-grant.
revoke execute on all functions in schema fff_private from public, anon, authenticated;
revoke execute on all functions in schema fff from public, anon, authenticated;

grant execute on function
  fff.submit_log(double precision, double precision, text, timestamptz, bigint),
  fff.update_profile(text, text),
  fff.set_time_zone(text),
  fff.set_home(double precision, double precision),
  fff.my_home(),
  fff.complete_onboarding(),
  fff.register_push_token(text, text),
  fff.delete_my_account(),
  fff.ensure_profile(),
  fff.my_status(),
  fff.request_friend(text),
  fff.respond_friend(uuid, boolean),
  fff.remove_friend(uuid),
  fff.my_friends(),
  fff.create_invite(),
  fff.accept_invite(text),
  fff.feed(timestamptz, int),
  fff.leaderboard(text, text, int),
  fff.spots(),
  fff.my_ticks()
to authenticated;

grant execute on function fff.claim_outbox(int), fff.finish_outbox(bigint[], jsonb, text[]) to service_role;
grant usage on schema fff_private to service_role;
grant execute on all functions in schema fff_private to service_role;

-- New functions are not executable by the API roles unless granted here.
alter default privileges in schema fff revoke execute on functions from public, anon, authenticated;
alter default privileges in schema fff_private revoke execute on functions from public, anon, authenticated;
