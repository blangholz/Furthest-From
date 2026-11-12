// What the app asks the backend. Two implementations: Supabase (real) and demo (on-device).
import type { Zone } from '../rules';

export type LogKind = 'ping' | 'extra_fries' | 'extreme';

export type Status = {
  userId: string;
  username: string | null;
  displayName: string;
  onboarded: boolean;
  hasHome: boolean;
  homeLockedUntil: string | null;
  streak: number;
  bestStreak: number;
  friesCredits: number;
  friesPer: number;
  friendCount: number;
  globalMinFriends: number;
  openPing: { id: number; opensAt: string; closesAt: string } | null;
  todayLogged: boolean;
  extraFries: { id: number; earnedAt: string; expiresAt: string }[];
  season: { name: string; endsAt: string };
  seasonPoints: number;
  allTimePoints: number;
};

export type LogResult = {
  logId: number;
  kind: LogKind;
  zone: Zone;
  distanceMi: number;
  points: number;
  regionName: string | null;
  season: string;
  streak: number;
  extraFriesEarned: number;
};

export type FeedItem = {
  logId: number;
  userId: string;
  displayName: string;
  isMe: boolean;
  kind: LogKind;
  zone: Zone;
  distanceMi: number;
  points: number;
  regionName: string | null;
  spotKind: 'state' | 'top100' | null;
  spotRank: number | null;
  spotState: string | null;
  loggedAt: string;
};

export type LeaderRow = { rank: number; userId: string; displayName: string; points: number; logs: number; isMe: boolean };

export type Spot = {
  id: number;
  kind: 'state' | 'top100';
  state: string;
  stateName: string;
  rank: number | null;
  lat: number;
  lon: number;
  distanceMi: number;
  land: string | null;
  claimed: boolean;
  claimedAt: string | null;
};

export type Friend = {
  userId: string;
  username: string | null;
  displayName: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
  streak: number | null;
  seasonPoints: number | null;
};

export type MyLog = {
  id: number;
  kind: LogKind;
  zone: Zone;
  distanceMi: number;
  points: number;
  regionName: string | null;
  loggedAt: string;
};

/** Error codes raised by the database functions (see supabase/migrations). */
export type ApiErrorCode =
  | 'no_open_ping'
  | 'no_extra_fries'
  | 'too_far'
  | 'already_claimed'
  | 'no_such_spot'
  | 'home_locked'
  | 'username_taken'
  | 'bad_username'
  | 'no_such_user'
  | 'cannot_friend_self'
  | 'bad_invite'
  | 'too_late'
  | 'no_store_data'
  | 'not_signed_in'
  | 'network'
  | 'unknown';

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message?: string, public detail?: string) {
    super(message ?? code);
  }
}

export interface Api {
  readonly mode: 'supabase' | 'demo';
  status(): Promise<Status>;
  submitLog(p: { lat: number; lon: number; kind: LogKind; loggedAt?: string; extremeId?: number }): Promise<LogResult>;
  updateProfile(p: { username?: string; displayName?: string }): Promise<void>;
  /** Makes this player's profile the first time they open the app. Safe to repeat. */
  ensureProfile(): Promise<void>;
  setTimeZone(tz: string): Promise<void>;
  setHome(lat: number, lon: number): Promise<{ lockedUntil: string }>;
  myHome(): Promise<{ lat: number; lon: number; lockedUntil: string | null } | null>;
  completeOnboarding(): Promise<void>;
  registerPushToken(token: string, platform: string): Promise<void>;
  deleteAccount(): Promise<void>;
  friends(): Promise<Friend[]>;
  requestFriend(username: string): Promise<'requested' | 'accepted' | 'pending'>;
  respondFriend(userId: string, accept: boolean): Promise<void>;
  removeFriend(userId: string): Promise<void>;
  createInvite(): Promise<string>;
  acceptInvite(code: string): Promise<{ status: string; friend?: string }>;
  feed(before?: string): Promise<FeedItem[]>;
  leaderboard(scope: 'friends' | 'global', period: 'season' | 'all'): Promise<LeaderRow[]>;
  spots(): Promise<Spot[]>;
  myLogs(zone: 'passport' | 'home'): Promise<MyLog[]>;
}

/** Friendly words for an error code. */
export function errorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'unknown';
  switch (code) {
    case 'no_open_ping': return 'No ping is open right now. The next one is at 1:20 PM.';
    case 'no_extra_fries': return "You don't have any Extra Fries to use.";
    case 'too_far': return `You need to be within 150 ft of the spot${e instanceof ApiError && e.detail ? ` (you're ${e.detail} away)` : ''}.`;
    case 'already_claimed': return "You've already claimed this one.";
    case 'home_locked': return 'Your home pin is locked until next season.';
    case 'username_taken': return 'That username is taken.';
    case 'bad_username': return 'Usernames are 3 to 20 letters, numbers or underscores.';
    case 'no_such_user': return 'No player has that username.';
    case 'cannot_friend_self': return "That's you!";
    case 'bad_invite': return "That invite link doesn't work.";
    case 'too_late': return 'That log is too old to upload.';
    case 'network': return "Couldn't reach the server. Your log is saved and will upload when you're back online.";
    default: return e instanceof Error ? e.message : 'Something went wrong.';
  }
}
