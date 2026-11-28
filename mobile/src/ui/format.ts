import { formatMiles } from '../lib/geo';
import type { FeedItem, LogResult } from '../lib/api';

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "43.5884° N, 118.9512° W": four decimals is about 30 ft, like a GPS readout. */
export function formatLatLon(p: { lat: number; lon: number }): string {
  const deg = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
  return `${deg(p.lat, 'N', 'S')}, ${deg(p.lon, 'E', 'W')}`;
}

/** Clock-style countdown: MM:SS under an hour, HH:MM:SS from an hour up. */
export function countdown(to: string | Date, now = Date.now()): string {
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const two = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${two(h)}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}

export function feedLine(f: FeedItem): string {
  const who = f.isMe ? 'You' : f.displayName;
  const mi = formatMiles(f.distanceMi);
  if (f.kind === 'extreme') {
    return f.spotKind === 'top100'
      ? `${who} reached Top 100 spot #${f.spotRank} (${f.spotState}), ${mi} mi from fries`
      : `${who} reached ${f.regionName ?? f.spotState}'s furthest point, ${mi} mi from fries`;
  }
  if (f.zone === 'passport') return `${who} ${f.isMe ? 'were' : 'was'} ${mi} mi from fries in ${f.regionName ?? 'another country'}`;
  if (f.zone === 'home') return `${who} checked in from home`;
  return `${who} ${f.isMe ? 'were' : 'was'} ${mi} mi from the nearest McDonald's`;
}

export function resultHeadline(r: LogResult): string {
  if (r.zone === 'home') return 'Home check-in';
  if (r.zone === 'passport') return `Passport stamp: ${r.regionName ?? 'abroad'}`;
  return `+${formatMiles(r.points)} points`;
}
