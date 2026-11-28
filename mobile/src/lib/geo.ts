// Straight-line distance helpers and a fast nearest-store index for the live readout.
// The live readout runs entirely on the phone against the bundled store list, so
// watching your distance never sends your location anywhere.

export type LatLon = { lat: number; lon: number };
/** A McDonald's: its point plus "Town, ST" when the bundled data has it. */
export type Store = LatLon & { place?: string };

const EARTH_RADIUS_MI = 3958.7613;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in miles. */
export function haversineMi(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from a to b, degrees clockwise from true north. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const miToFt = (mi: number) => mi * 5280;

/** Grid index over store points (1 degree cells). Nearest lookups search rings outward. */
export class StoreIndex {
  private cells = new Map<string, Store[]>();
  readonly size: number;

  /** places[i] names points[i] ("Burns, OR"); optional so older data files still load. */
  constructor(points: [number, number][], places?: (string | null)[]) {
    points.forEach(([lat, lon], i) => {
      const k = StoreIndex.key(Math.floor(lat), Math.floor(lon));
      let c = this.cells.get(k);
      if (!c) this.cells.set(k, (c = []));
      const place = places?.[i];
      c.push(place ? { lat, lon, place } : { lat, lon });
    });
    this.size = points.length;
  }

  private static key(la: number, lo: number) {
    return `${la}:${lo}`;
  }

  private cell(la: number, lo: number): Store[] {
    const wrapped = ((((lo + 180) % 360) + 360) % 360) - 180;
    return this.cells.get(StoreIndex.key(la, wrapped)) ?? [];
  }

  /** Nearest store and its distance in miles, or null if the index is empty. */
  nearest(p: LatLon): { store: Store; mi: number } | null {
    if (this.size === 0) return null;
    const la0 = Math.floor(p.lat);
    const lo0 = Math.floor(p.lon);
    let best: Store | null = null;
    let bestMi = Infinity;
    // One degree of latitude is ~69 mi; a ring r cells out is at least (r - 1) * 69 * cos(lat) mi away.
    const cosLat = Math.max(0.05, Math.cos(toRad(Math.min(89, Math.abs(p.lat) + 1))));
    for (let r = 0; r <= 180; r++) {
      const ringMin = Math.max(0, r - 1) * 69 * cosLat;
      if (ringMin > bestMi) break;
      for (let dla = -r; dla <= r; dla++) {
        for (let dlo = -r; dlo <= r; dlo++) {
          if (Math.abs(dla) !== r && Math.abs(dlo) !== r) continue; // ring only
          const la = la0 + dla;
          if (la < -90 || la > 89) continue;
          for (const s of this.cell(la, lo0 + dlo)) {
            const d = haversineMi(p, s);
            if (d < bestMi) {
              bestMi = d;
              best = s;
            }
          }
        }
      }
    }
    return best ? { store: best, mi: bestMi } : null;
  }

  /** Stores within a radius, for the personal map. */
  within(p: LatLon, radiusMi: number, limit = 300): LatLon[] {
    const dLat = Math.ceil(radiusMi / 69) + 1;
    const dLon = Math.ceil(radiusMi / (69 * Math.max(0.05, Math.cos(toRad(p.lat))))) + 1;
    const out: { s: LatLon; d: number }[] = [];
    const la0 = Math.floor(p.lat);
    const lo0 = Math.floor(p.lon);
    for (let dla = -dLat; dla <= dLat; dla++)
      for (let dlo = -dLon; dlo <= dLon; dlo++)
        for (const s of this.cell(la0 + dla, lo0 + dlo)) {
          const d = haversineMi(p, s);
          if (d <= radiusMi) out.push({ s, d });
        }
    return out.sort((a, b) => a.d - b.d).slice(0, limit).map((x) => x.s);
  }
}

/** Point `mi` miles from p along `deg` (clockwise from north). Flat-earth step, fine for a few miles. */
export function offsetMi(p: LatLon, deg: number, mi: number): LatLon {
  const t = toRad(deg);
  return {
    lat: p.lat + (Math.cos(t) * mi) / 69,
    lon: p.lon + (Math.sin(t) * mi) / (69 * Math.max(0.05, Math.cos(toRad(p.lat)))),
  };
}

/**
 * Which way to head to get as far from McDonald's as you can within `horizonMi`: for each of
 * 72 directions (5 deg), walk out in 0.25 mi steps and note the farthest-from-any-store point
 * along that line; the arrow points down the line with the best one (a near-tie, within 0.05 mi,
 * goes to the one that's closer to reach). This finds the big empty area (mountains, desert) rather than
 * just the steepest way out of where you stand, which can point at a dead end.
 *
 * Fast: every sample is within horizonMi of p, so its nearest store is within
 * nearest(p) + horizonMi of p. Those candidates are fetched once and checked with flat-earth
 * math (good to well under 1% at these distances).
 */
export function escapeBearing(index: StoreIndex, p: LatLon, horizonMi = 5): number | null {
  const here = index.nearest(p);
  if (!here) return null;
  const cands = index.within(p, here.mi + horizonMi + 0.5, 5000);
  if (!cands.length) cands.push(here.store);
  const kx = 69 * Math.cos(toRad(p.lat));
  const xs = cands.map((c) => (c.lon - p.lon) * kx);
  const ys = cands.map((c) => (c.lat - p.lat) * 69);
  const nearestAt = (x: number, y: number) => {
    let m = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2;
      if (d < m) m = d;
    }
    return Math.sqrt(m);
  };
  const STEP = 0.25;
  const TIE_MI = 0.05; // absolute, so it means the same thing 1 mi or 80 mi from a store
  let best: number | null = null;
  let bestPeak = -Infinity;
  let bestAt = Infinity;
  for (let deg = 0; deg < 360; deg += 5) {
    const dx = Math.sin(toRad(deg));
    const dy = Math.cos(toRad(deg));
    let peak = -Infinity;
    let at = 0;
    for (let s = STEP; s <= horizonMi + 1e-9; s += STEP) {
      const m = nearestAt(dx * s, dy * s);
      if (m > peak) {
        peak = m;
        at = s;
      }
    }
    const clearlyBetter = peak > bestPeak + TIE_MI;
    const tieButCloser = peak >= bestPeak - TIE_MI && at < bestAt;
    if (best == null || clearlyBetter || tieButCloser) {
      if (clearlyBetter || peak > bestPeak) bestPeak = peak;
      best = deg;
      bestAt = at;
    }
  }
  return best;
}

export function formatMiles(mi: number | null | undefined): string {
  if (mi == null || !isFinite(mi)) return '--';
  return mi.toFixed(1);
}

export function formatFeet(ft: number): string {
  return ft < 1000 ? `${Math.round(ft)} ft` : `${(ft / 5280).toFixed(1)} mi`;
}
