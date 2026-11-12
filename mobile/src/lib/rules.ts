// Game rules shared by the app's display code and the demo backend.
// The real source of truth is the database (supabase/migrations); keep these in step.
import { haversineMi, type LatLon } from './geo';

export const RULES = {
  pingLocalTime: { hour: 13, minute: 20 }, // 1:20 PM in the player's own time zone
  pingWindowMin: 60,
  homeRadiusMi: 5,
  claimRadiusFt: 150,
  friesPerCredits: 7,
  doubleCreditStreak: 12,
  friesTtlDays: 14,
  globalMinFriends: 3,
  mapRadiusMi: 25,
} as const;

export type Zone = 'scoring' | 'home' | 'passport';

/** Rough lower-48 test used only by the demo backend (the server uses state polygons). */
export function roughlyLower48(p: LatLon): boolean {
  if (p.lat < 24.4 || p.lat > 49.4 || p.lon < -124.8 || p.lon > -66.9) return false;
  // Exclude the obvious Canadian bits inside the box: southern Ontario / Quebec and the Maritimes.
  if (p.lat > 41.7 && p.lon > -83.5 && p.lon < -74.5 && p.lat > 42.3 + (p.lon + 83.5) * 0.25) return false;
  if (p.lat > 45.0 && p.lon > -71.5 && p.lon < -67.0 && p.lat > 47.3) return false;
  return true;
}

export function classify(p: LatLon, home: LatLon | null, inLower48: boolean): Zone {
  if (home && haversineMi(p, home) <= RULES.homeRadiusMi) return 'home';
  return inLower48 ? 'scoring' : 'passport';
}

export const pointsFor = (zone: Zone, mi: number) => (zone === 'scoring' ? Math.round(mi * 100) / 100 : 0);

/** Credits a qualifying ping adds toward the next Extra Fries, given the streak including it. */
export const creditsFor = (streakIncludingThis: number) => (streakIncludingThis >= RULES.doubleCreditStreak ? 2 : 1);

/** Adds credits; returns how many Extra Fries were earned and what carries over. */
export function addCredits(current: number, added: number): { earned: number; remaining: number } {
  const total = current + added;
  return { earned: Math.floor(total / RULES.friesPerCredits), remaining: total % RULES.friesPerCredits };
}

export type PingOutcome = { status: 'logged' | 'missed'; zone?: Zone };

/** Streak from newest to oldest ping: qualifying pings count, home check-ins pause, a miss stops. */
export function streakFrom(newestFirst: PingOutcome[]): number {
  let n = 0;
  for (const o of newestFirst) {
    if (o.status === 'missed') break;
    if (o.zone !== 'home') n++;
  }
  return n;
}

/** Meteorological seasons in Pacific time, named like the server ('Fall 2026', 'Winter 2026-27'). */
export function seasonName(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric' })
    .formatToParts(d);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  if (m >= 3 && m <= 5) return `Spring ${y}`;
  if (m >= 6 && m <= 8) return `Summer ${y}`;
  if (m >= 9 && m <= 11) return `Fall ${y}`;
  const start = m === 12 ? y : y - 1;
  return `Winter ${start}-${String(start + 1).slice(2)}`;
}

/** The device's current IANA time zone; the daily ping follows it. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  } catch {
    return 'America/Los_Angeles';
  }
}

/** Today's 1:20 PM ping window in the device's own time zone. */
export function todaysPingWindow(now = new Date()): { opensAt: Date; closesAt: Date } {
  const opensAt = new Date(now);
  opensAt.setHours(RULES.pingLocalTime.hour, RULES.pingLocalTime.minute, 0, 0);
  return { opensAt, closesAt: new Date(opensAt.getTime() + RULES.pingWindowMin * 60_000) };
}
