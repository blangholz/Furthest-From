// Demo backend: the whole game on the phone, with sample friends and no account.
// Used when no Supabase URL is configured, so the app can be tried right away.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversineMi, miToFt } from '../geo';
import { addCredits, classify, creditsFor, pointsFor, roughlyLower48, RULES, seasonName, streakFrom, todaysPingWindow, type Zone } from '../rules';
import { bundledSpots, storeIndex } from '../stores';
import { ApiError, type Api, type FeedItem, type LeaderRow, type LogKind, type Spot } from './types';

const KEY = 'fff-demo-state-v1';
const ME = 'demo-me';

type DemoLog = {
  id: number; userId: string; kind: LogKind; zone: Zone; distanceMi: number; regionName: string | null;
  spotId?: number; loggedAt: string;
};
type DemoState = {
  username: string | null; displayName: string; onboarded: boolean;
  home: { lat: number; lon: number; season: string } | null;
  credits: number; bestStreak: number;
  pings: { date: string; opensAt: string; closesAt: string; status: 'open' | 'logged' | 'missed'; logId?: number }[];
  fries: { id: number; earnedAt: string; expiresAt: string; usedAt?: string }[];
  logs: DemoLog[]; ticks: { spotId: number; kind: 'state' | 'top100'; state: string; claimedAt: string }[];
  friends: { userId: string; displayName: string; username: string; status: 'pending' | 'accepted'; incoming: boolean }[];
  nextId: number; demoPingOpen: boolean;
};

const SAMPLE_FRIENDS = [
  { userId: 'demo-sam', displayName: 'Sam', username: 'sam' },
  { userId: 'demo-riley', displayName: 'Riley', username: 'riley' },
  { userId: 'demo-jo', displayName: 'Jo', username: 'jo' },
];

function fresh(): DemoState {
  const now = Date.now();
  const logs: DemoLog[] = [];
  let id = 1;
  // A few days of friend activity so the feed and boards have something in them.
  const samples: [string, number, Zone, string | null][] = [
    ['demo-sam', 63.2, 'scoring', null], ['demo-riley', 12.4, 'scoring', null], ['demo-jo', 512.0, 'passport', 'Iceland'],
    ['demo-sam', 88.7, 'scoring', null], ['demo-riley', 31.9, 'scoring', null], ['demo-jo', 4.1, 'scoring', null],
  ];
  samples.forEach(([userId, mi, zone, region], i) =>
    logs.push({ id: id++, userId, kind: 'ping', zone, distanceMi: mi, regionName: region,
      loggedAt: new Date(now - (i + 1) * 20 * 3600_000).toISOString() }));
  return {
    username: null, displayName: '', onboarded: false, home: null, credits: 0, bestStreak: 0, pings: [], fries: [],
    logs, ticks: [], friends: SAMPLE_FRIENDS.map((f) => ({ ...f, status: 'accepted' as const, incoming: false })),
    nextId: id, demoPingOpen: false,
  };
}

let state: DemoState | null = null;
async function load(): Promise<DemoState> {
  if (state) return state;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    state = raw ? (JSON.parse(raw) as DemoState) : fresh();
  } catch {
    state = fresh();
  }
  return state;
}
async function save() {
  if (state) await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}
const localDate = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Opens today's ping at 1:20 PM local, and marks earlier windows as missed. */
function tickPings(s: DemoState, now = new Date()) {
  for (const p of s.pings) if (p.status === 'open' && new Date(p.closesAt) < now) p.status = 'missed';
  const w = todaysPingWindow(now);
  const today = localDate(now);
  if (s.onboarded && now >= w.opensAt && !s.pings.some((p) => p.date === today)) {
    s.pings.unshift({ date: today, opensAt: w.opensAt.toISOString(), closesAt: w.closesAt.toISOString(), status: now <= w.closesAt ? 'open' : 'missed' });
  }
}

function streak(s: DemoState) {
  return streakFrom(
    s.pings.filter((p) => p.status !== 'open').map((p) => ({
      status: p.status as 'logged' | 'missed',
      zone: s.logs.find((l) => l.id === p.logId)?.zone,
    })),
  );
}

const nameOf = (s: DemoState, userId: string) =>
  userId === ME ? s.displayName || s.username || 'You' : s.friends.find((f) => f.userId === userId)?.displayName ?? 'Player';

function spotsList(): (Spot & { miles: number })[] {
  return bundledSpots().map((b, i) => ({
    id: i + 1, kind: b.kind, state: b.state, stateName: b.state_name, rank: b.rank, lat: b.lat, lon: b.lon,
    distanceMi: b.miles, miles: b.miles, land: b.land, claimed: false, claimedAt: null,
  }));
}

export const demoApi: Api & { openDemoPing(): Promise<void>; reset(): Promise<void> } = {
  mode: 'demo',

  async openDemoPing() {
    const s = await load();
    const now = new Date();
    s.pings = s.pings.filter((p) => !(p.status === 'open'));
    s.pings.unshift({ date: `demo-${now.getTime()}`, opensAt: now.toISOString(), closesAt: new Date(now.getTime() + 3600_000).toISOString(), status: 'open' });
    await save();
  },
  async reset() {
    state = fresh();
    await save();
  },

  async status() {
    const s = await load();
    tickPings(s);
    const now = new Date();
    const open = s.pings.find((p) => p.status === 'open' && new Date(p.opensAt) <= now && now <= new Date(p.closesAt));
    const season = seasonName(now);
    const mine = s.logs.filter((l) => l.userId === ME);
    const sum = (ls: DemoLog[]) => ls.reduce((a, l) => a + pointsFor(l.zone, l.distanceMi), 0);
    await save();
    return {
      userId: ME, username: s.username, displayName: s.displayName, onboarded: s.onboarded, hasHome: !!s.home,
      homeLockedUntil: s.home ? 'end of season' : null, streak: streak(s), bestStreak: s.bestStreak,
      friesCredits: s.credits, friesPer: RULES.friesPerCredits, friendCount: s.friends.filter((f) => f.status === 'accepted').length,
      globalMinFriends: RULES.globalMinFriends,
      openPing: open ? { id: 0, opensAt: open.opensAt, closesAt: open.closesAt } : null,
      todayLogged: s.pings.some((p) => p.date === localDate(now) && p.status === 'logged'),
      extraFries: s.fries.filter((f) => !f.usedAt && new Date(f.expiresAt) > now),
      season: { name: season, endsAt: '' },
      seasonPoints: sum(mine.filter((l) => seasonName(new Date(l.loggedAt)) === season)),
      allTimePoints: sum(mine),
    };
  },

  async submitLog({ lat, lon, kind, extremeId }) {
    const s = await load();
    tickPings(s);
    const now = new Date();
    const p = { lat, lon };
    let ping: DemoState['pings'][number] | undefined;
    let fry: DemoState['fries'][number] | undefined;
    let spot: Spot | undefined;
    if (kind === 'ping') {
      ping = s.pings.find((x) => x.status === 'open' && new Date(x.opensAt) <= now && now <= new Date(x.closesAt));
      if (!ping) throw new ApiError('no_open_ping');
    } else if (kind === 'extra_fries') {
      fry = s.fries.find((f) => !f.usedAt && new Date(f.expiresAt) > now);
      if (!fry) throw new ApiError('no_extra_fries');
    } else {
      spot = spotsList().find((x) => x.id === extremeId);
      if (!spot) throw new ApiError('no_such_spot');
      const ft = miToFt(haversineMi(p, spot));
      if (ft > RULES.claimRadiusFt) throw new ApiError('too_far', undefined, `${Math.round(ft).toLocaleString()} ft`);
      if (s.ticks.some((t) => (spot!.kind === 'state' && t.kind === 'state' && t.state === spot!.state) || t.spotId === spot!.id))
        throw new ApiError('already_claimed');
    }
    const nearest = storeIndex().nearest(p);
    if (!nearest) throw new ApiError('no_store_data');
    const inL48 = roughlyLower48(p);
    const zone = classify(p, s.home, inL48);
    const distanceMi = Math.round(nearest.mi * 100) / 100;
    const log: DemoLog = {
      id: s.nextId++, userId: ME, kind, zone, distanceMi,
      regionName: spot ? spot.stateName : zone === 'passport' ? 'Outside the lower 48' : null,
      spotId: spot?.id, loggedAt: now.toISOString(),
    };
    s.logs.unshift(log);
    let earned = 0;
    if (ping) {
      ping.status = 'logged';
      ping.logId = log.id;
      const st = streak(s);
      s.bestStreak = Math.max(s.bestStreak, st);
      if (zone !== 'home') {
        const r = addCredits(s.credits, creditsFor(st));
        s.credits = r.remaining;
        earned = r.earned;
        for (let i = 0; i < earned; i++)
          s.fries.push({ id: s.nextId++, earnedAt: now.toISOString(), expiresAt: new Date(now.getTime() + RULES.friesTtlDays * 86400_000).toISOString() });
      }
    }
    if (fry) fry.usedAt = now.toISOString();
    if (spot) s.ticks.push({ spotId: spot.id, kind: spot.kind, state: spot.state, claimedAt: now.toISOString() });
    await save();
    return {
      logId: log.id, kind, zone, distanceMi, points: pointsFor(zone, distanceMi), regionName: log.regionName,
      season: seasonName(now), streak: streak(s), extraFriesEarned: earned,
    };
  },

  async updateProfile({ username, displayName }) {
    const s = await load();
    if (username != null) {
      const u = username.toLowerCase().replace(/^@/, '');
      if (!/^[a-z0-9_]{3,20}$/.test(u)) throw new ApiError('bad_username');
      if (SAMPLE_FRIENDS.some((f) => f.username === u)) throw new ApiError('username_taken');
      s.username = u;
    }
    if (displayName != null) s.displayName = displayName.trim().slice(0, 40);
    await save();
  },
  async setTimeZone() {},
  async setHome(lat, lon) {
    const s = await load();
    const season = seasonName(new Date());
    if (s.home && s.home.season === season) throw new ApiError('home_locked');
    s.home = { lat, lon, season };
    await save();
    return { lockedUntil: `the end of ${season}` };
  },
  async myHome() {
    const s = await load();
    return s.home ? { lat: s.home.lat, lon: s.home.lon, lockedUntil: null } : null;
  },
  async completeOnboarding() {
    const s = await load();
    s.onboarded = true;
    await save();
  },
  async registerPushToken() {},
  async deleteAccount() {
    await demoApi.reset();
  },

  async friends() {
    const s = await load();
    return s.friends.map((f) => ({
      userId: f.userId, username: f.username, displayName: f.displayName, status: f.status, incoming: f.incoming,
      streak: f.status === 'accepted' ? 3 : null,
      seasonPoints: s.logs.filter((l) => l.userId === f.userId).reduce((a, l) => a + pointsFor(l.zone, l.distanceMi), 0),
    }));
  },
  async requestFriend(username) {
    const s = await load();
    const u = username.toLowerCase().replace(/^@/, '');
    if (u === s.username) throw new ApiError('cannot_friend_self');
    if (s.friends.some((f) => f.username === u)) return 'accepted';
    s.friends.push({ userId: `demo-${u}`, displayName: u, username: u, status: 'pending', incoming: false });
    await save();
    return 'requested';
  },
  async respondFriend(userId, accept) {
    const s = await load();
    s.friends = s.friends.flatMap((f) => (f.userId !== userId ? [f] : accept ? [{ ...f, status: 'accepted' as const }] : []));
    await save();
  },
  async removeFriend(userId) {
    const s = await load();
    s.friends = s.friends.filter((f) => f.userId !== userId);
    await save();
  },
  async createInvite() {
    return 'demo1234';
  },
  async acceptInvite() {
    return { status: 'accepted', friend: 'Sam' };
  },

  async feed() {
    const s = await load();
    const friendIds = new Set(s.friends.filter((f) => f.status === 'accepted').map((f) => f.userId));
    const spots = spotsList();
    return s.logs
      .filter((l) => (l.userId === ME || friendIds.has(l.userId)) && (l.zone !== 'home' || l.userId === ME))
      .map((l): FeedItem => {
        const sp = spots.find((x) => x.id === l.spotId);
        return {
          logId: l.id, userId: l.userId, displayName: nameOf(s, l.userId), isMe: l.userId === ME, kind: l.kind, zone: l.zone,
          distanceMi: l.distanceMi, points: pointsFor(l.zone, l.distanceMi),
          regionName: l.zone === 'passport' || l.kind === 'extreme' ? l.regionName : null,
          spotKind: sp?.kind ?? null, spotRank: sp?.rank ?? null, spotState: sp?.state ?? null, loggedAt: l.loggedAt,
        };
      });
  },
  async leaderboard(scope, period) {
    const s = await load();
    const season = seasonName(new Date());
    const ids = [ME, ...s.friends.filter((f) => f.status === 'accepted').map((f) => f.userId)];
    if (scope === 'global' && s.friends.filter((f) => f.status === 'accepted').length < RULES.globalMinFriends) ids.shift();
    const rows = ids.map((id) => {
      const ls = s.logs.filter((l) => l.userId === id && l.zone === 'scoring' && (period === 'all' || seasonName(new Date(l.loggedAt)) === season));
      return { userId: id, displayName: nameOf(s, id), points: ls.reduce((a, l) => a + l.distanceMi, 0), logs: ls.length, isMe: id === ME };
    });
    rows.sort((a, b) => b.points - a.points);
    return rows.map((r, i): LeaderRow => ({ ...r, rank: i + 1 }));
  },
  async spots() {
    const s = await load();
    return spotsList().map(({ miles: _m, ...sp }) => {
      const t = s.ticks.find((k) => k.spotId === sp.id || (sp.kind === 'state' && k.kind === 'state' && k.state === sp.state));
      return { ...sp, claimed: !!t, claimedAt: t?.claimedAt ?? null };
    });
  },
  async myLogs(zone) {
    const s = await load();
    return s.logs
      .filter((l) => l.userId === ME && l.zone === zone)
      .map((l) => ({ id: l.id, kind: l.kind, zone: l.zone, distanceMi: l.distanceMi, points: pointsFor(l.zone, l.distanceMi), regionName: l.regionName, loggedAt: l.loggedAt }));
  },
};
