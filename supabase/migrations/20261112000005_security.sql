-- Far From Fries: row-level security and grants.
-- Players read only their own rows directly. Anything about friends comes through
-- security-definer functions that return distances, never coordinates.

alter table public.game_settings enable row level security;
alter table public.seasons enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.invites enable row level security;
alter table public.push_tokens enable row level security;
alter table public.data_versions enable row level security;
alter table public.stores enable row level security;
alter table public.regions enable row level security;
alter table public.extremes enable row level security;
alter table public.ping_deliveries enable row level security;
alter table public.logs enable row level security;
alter table public.extra_fries enable row level security;
alter table public.extreme_ticks enable row level security;
alter table public.outbox enable row level security;

-- Start from nothing, then grant reads only.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.game_settings, public.seasons, public.data_versions, public.stores
  to authenticated;
grant select on public.logs, public.ping_deliveries, public.extra_fries, public.extreme_ticks,
  public.friendships, public.invites to authenticated;
-- Profiles: everything except the home pin. home_point is only reachable through my_home().
grant select (id, username, display_name, time_zone, home_season_id, streak_count, best_streak,
              fries_credits, onboarded_at, created_at) on public.profiles to authenticated;

create policy "settings readable" on public.game_settings for select to authenticated using (true);
create policy "seasons readable" on public.seasons for select to authenticated using (true);
create policy "data versions readable" on public.data_versions for select to authenticated using (true);
create policy "stores readable" on public.stores for select to authenticated using (true);
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own logs" on public.logs for select to authenticated using (user_id = auth.uid());
create policy "own pings" on public.ping_deliveries for select to authenticated using (user_id = auth.uid());
create policy "own fries" on public.extra_fries for select to authenticated using (user_id = auth.uid());
create policy "own ticks" on public.extreme_ticks for select to authenticated using (user_id = auth.uid());
create policy "own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy "own invites" on public.invites for select to authenticated using (inviter = auth.uid());
-- regions, extremes, push_tokens, outbox: no direct access (spots() lists extremes).

-- Functions: Postgres grants EXECUTE to PUBLIC by default, so revoke and re-grant.
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.submit_log(double precision, double precision, text, timestamptz, bigint),
  public.update_profile(text, text),
  public.set_time_zone(text),
  public.set_home(double precision, double precision),
  public.my_home(),
  public.complete_onboarding(),
  public.register_push_token(text, text),
  public.delete_my_account(),
  public.my_status(),
  public.request_friend(text),
  public.respond_friend(uuid, boolean),
  public.remove_friend(uuid),
  public.my_friends(),
  public.create_invite(),
  public.accept_invite(text),
  public.feed(timestamptz, int),
  public.leaderboard(text, text, int),
  public.spots(),
  public.my_ticks()
to authenticated;

grant execute on function public.claim_outbox(int), public.finish_outbox(bigint[], jsonb, text[]) to service_role;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;

-- New functions are not executable by the API roles unless granted here.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
