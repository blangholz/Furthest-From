// Straight-line distance helpers and a fast nearest-store index for the live readout.
// The live readout runs entirely on the phone against the bundled store list, so
// watching your distance never sends your location anywhere.

export type LatLon = { lat: number; lon: number };

const EARTH_RADIUS_MI = 3958.7613;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in miles. */
export function haversineMi(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const miToFt = (mi: number) => mi * 5280;

/** Grid index over store points (1 degree cells). Nearest lookups search rings outward. */
export class StoreIndex {
  private cells = new Map<string, LatLon[]>();
  readonly size: number;

  constructor(points: [number, number][]) {
    for (const [lat, lon] of points) {
      const k = StoreIndex.key(Math.floor(lat), Math.floor(lon));
      let c = this.cells.get(k);
      if (!c) this.cells.set(k, (c = []));
      c.push({ lat, lon });
    }
    this.size = points.length;
  }

  private static key(la: number, lo: number) {
    return `${la}:${lo}`;
  }

  private cell(la: number, lo: number): LatLon[] {
    const wrapped = ((((lo + 180) % 360) + 360) % 360) - 180;
    return this.cells.get(StoreIndex.key(la, wrapped)) ?? [];
  }

  /** Nearest store and its distance in miles, or null if the index is empty. */
  nearest(p: LatLon): { store: LatLon; mi: number } | null {
    if (this.size === 0) return null;
    const la0 = Math.floor(p.lat);
    const lo0 = Math.floor(p.lon);
    let best: LatLon | null = null;
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

export function formatMiles(mi: number | null | undefined): string {
  if (mi == null || !isFinite(mi)) return '--';
  return mi.toFixed(1);
}

export function formatFeet(ft: number): string {
  return ft < 1000 ? `${Math.round(ft)} ft` : `${(ft / 5280).toFixed(1)} mi`;
}
