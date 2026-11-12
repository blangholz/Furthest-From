import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, type Api, type ApiErrorCode, type FeedItem, type Friend, type LeaderRow, type MyLog, type Spot, type Status } from './types';

const KNOWN: ApiErrorCode[] = [
  'no_open_ping', 'no_extra_fries', 'too_far', 'already_claimed', 'no_such_spot', 'home_locked', 'username_taken',
  'bad_username', 'no_such_user', 'cannot_friend_self', 'bad_invite', 'too_late', 'no_store_data', 'not_signed_in',
];

function toApiError(e: { message?: string; details?: string | null } | unknown): ApiError {
  const msg = (e as { message?: string })?.message ?? String(e);
  const code = KNOWN.find((k) => msg === k || msg.includes(k));
  if (code) return new ApiError(code, msg, (e as { details?: string })?.details ?? undefined);
  if (/network|fetch|timed? ?out/i.test(msg)) return new ApiError('network', msg);
  return new ApiError('unknown', msg);
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export function supabaseApi(db: SupabaseClient): Api {
  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    let res;
    try {
      res = await db.rpc(fn, args);
    } catch (e) {
      throw toApiError(e);
    }
    if (res.error) throw toApiError(res.error);
    return res.data as T;
  }

  return {
    mode: 'supabase',

    async status() {
      const s = await rpc<Record<string, any>>('my_status');
      return {
        userId: s.user_id,
        username: s.username,
        displayName: s.display_name ?? '',
        onboarded: s.onboarded,
        hasHome: s.has_home,
        homeLockedUntil: s.home_locked_until,
        streak: s.streak,
        bestStreak: s.best_streak,
        friesCredits: s.fries_credits,
        friesPer: s.fries_per,
        friendCount: num(s.friend_count),
        globalMinFriends: s.global_min_friends,
        openPing: s.open_ping ? { id: s.open_ping.id, opensAt: s.open_ping.opens_at, closesAt: s.open_ping.closes_at } : null,
        todayLogged: s.today_logged,
        extraFries: (s.extra_fries ?? []).map((f: any) => ({ id: f.id, earnedAt: f.earned_at, expiresAt: f.expires_at })),
        season: { name: s.season?.name, endsAt: s.season?.ends_at },
        seasonPoints: num(s.season_points),
        allTimePoints: num(s.all_time_points),
      } satisfies Status;
    },

    async submitLog({ lat, lon, kind, loggedAt, extremeId }) {
      const r = await rpc<Record<string, any>>('submit_log', {
        p_lat: lat, p_lon: lon, p_kind: kind, p_logged_at: loggedAt ?? null, p_extreme_id: extremeId ?? null,
      });
      return {
        logId: r.log_id, kind: r.kind, zone: r.zone, distanceMi: num(r.distance_mi), points: num(r.points),
        regionName: r.region_name, season: r.season, streak: r.streak, extraFriesEarned: r.extra_fries_earned,
      };
    },

    async updateProfile({ username, displayName }) {
      await rpc('update_profile', { p_username: username ?? null, p_display_name: displayName ?? null });
    },
    async setTimeZone(tz) {
      await rpc('set_time_zone', { p_time_zone: tz });
    },
    async setHome(lat, lon) {
      const r = await rpc<{ locked_until: string }>('set_home', { p_lat: lat, p_lon: lon });
      return { lockedUntil: r.locked_until };
    },
    async myHome() {
      const r = await rpc<{ lat: number; lon: number; locked_until: string | null } | null>('my_home');
      return r ? { lat: r.lat, lon: r.lon, lockedUntil: r.locked_until } : null;
    },
    async completeOnboarding() {
      await rpc('complete_onboarding');
    },
    async registerPushToken(token, platform) {
      await rpc('register_push_token', { p_token: token, p_platform: platform });
    },
    async deleteAccount() {
      await rpc('delete_my_account');
      await db.auth.signOut();
    },

    async friends() {
      const rows = await rpc<any[]>('my_friends');
      return rows.map((r) => ({
        userId: r.user_id, username: r.username, displayName: r.display_name || r.username || 'Player',
        status: r.status, incoming: r.incoming, streak: r.streak, seasonPoints: r.season_points == null ? null : num(r.season_points),
      } satisfies Friend));
    },
    async requestFriend(username) {
      return rpc('request_friend', { p_username: username });
    },
    async respondFriend(userId, accept) {
      await rpc('respond_friend', { p_other: userId, p_accept: accept });
    },
    async removeFriend(userId) {
      await rpc('remove_friend', { p_other: userId });
    },
    async createInvite() {
      return rpc<string>('create_invite');
    },
    async acceptInvite(code) {
      return rpc('accept_invite', { p_code: code });
    },

    async feed(before) {
      const rows = await rpc<any[]>('feed', { p_before: before ?? null, p_limit: 50 });
      return rows.map((r) => ({
        logId: r.log_id, userId: r.user_id, displayName: r.display_name, isMe: r.is_me, kind: r.kind, zone: r.zone,
        distanceMi: num(r.distance_mi), points: num(r.points), regionName: r.region_name, spotKind: r.spot_kind,
        spotRank: r.spot_rank, spotState: r.spot_state, loggedAt: r.logged_at,
      } satisfies FeedItem));
    },
    async leaderboard(scope, period) {
      const rows = await rpc<any[]>('leaderboard', { p_scope: scope, p_period: period, p_limit: 100 });
      return rows.map((r) => ({
        rank: num(r.rank), userId: r.user_id, displayName: r.display_name, points: num(r.points), logs: num(r.logs), isMe: r.is_me,
      } satisfies LeaderRow));
    },
    async spots() {
      const rows = await rpc<any[]>('spots');
      return rows.map((r) => ({
        id: r.id, kind: r.kind, state: r.state, stateName: r.state_name, rank: r.rank, lat: r.lat, lon: r.lon,
        distanceMi: num(r.distance_mi), land: r.land, claimed: r.claimed, claimedAt: r.claimed_at,
      } satisfies Spot));
    },
    async myLogs(zone) {
      const { data, error } = await db
        .from('logs')
        .select('id, kind, zone, distance_mi, points, region_name, logged_at')
        .eq('zone', zone)
        .order('logged_at', { ascending: false })
        .limit(200);
      if (error) throw toApiError(error);
      return (data ?? []).map((r: any) => ({
        id: r.id, kind: r.kind, zone: r.zone, distanceMi: num(r.distance_mi), points: num(r.points),
        regionName: r.region_name, loggedAt: r.logged_at,
      } satisfies MyLog));
    },
  };
}
