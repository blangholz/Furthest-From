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

export function countdown(toIso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((new Date(toIso).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
