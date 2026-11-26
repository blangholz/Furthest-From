import { haversineMi, StoreIndex, formatMiles, escapeBearing, bearingDeg } from '../geo';

const RENO = { lat: 39.5296, lon: -119.8138 };
const PAHRUMP = { lat: 36.2083, lon: -115.9839 };
const ELY = { lat: 39.2533, lon: -114.8742 };

describe('haversineMi', () => {
  it('Reno to Ely is about 265 miles', () => {
    expect(haversineMi(RENO, ELY)).toBeGreaterThan(260);
    expect(haversineMi(RENO, ELY)).toBeLessThan(270);
  });
  it('is zero for the same point', () => expect(haversineMi(RENO, RENO)).toBe(0));
});

describe('StoreIndex', () => {
  const idx = new StoreIndex([[RENO.lat, RENO.lon], [PAHRUMP.lat, PAHRUMP.lon], [ELY.lat, ELY.lon]]);

  it('finds the nearest store across empty cells', () => {
    // The lower-48 furthest spot: Pahrump and Ely are both about 120 mi away.
    const r = idx.nearest({ lat: 37.92599, lon: -116.31842 })!;
    expect(r.mi).toBeGreaterThan(118);
    expect(r.mi).toBeLessThan(121);
  });

  it('matches brute force on random points', () => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 500; i++) pts.push([25 + Math.random() * 24, -124 + Math.random() * 57]);
    const big = new StoreIndex(pts);
    for (let i = 0; i < 50; i++) {
      const p = { lat: 25 + Math.random() * 24, lon: -124 + Math.random() * 57 };
      const brute = Math.min(...pts.map(([lat, lon]) => haversineMi(p, { lat, lon })));
      expect(big.nearest(p)!.mi).toBeCloseTo(brute, 6);
    }
  });

  it('lists stores within a radius', () => {
    expect(idx.within({ lat: 39.5, lon: -119.8 }, 25)).toHaveLength(1);
  });

  it('handles an empty index', () => expect(new StoreIndex([]).nearest(RENO)).toBeNull());
});

it('formats miles to one decimal', () => {
  expect(formatMiles(63.24)).toBe('63.2');
  expect(formatMiles(null)).toBe('--');
});

describe('store places', () => {
  it('returns the nearest store with its town when the data has one', () => {
    const idx = new StoreIndex([[43.5866, -119.0545], [44.06, -121.31]], ['Burns, OR', null]);
    const near = idx.nearest({ lat: 43.6, lon: -119 });
    expect(near?.store.place).toBe('Burns, OR');
    expect(idx.nearest({ lat: 44.05, lon: -121.3 })?.store.place).toBeUndefined();
  });

  it('still loads data files without places', () => {
    expect(new StoreIndex([[40, -100]]).nearest({ lat: 40, lon: -100 })?.store).toEqual({ lat: 40, lon: -100 });
  });
});

describe('escapeBearing', () => {
  const angleGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  it('points away from a lone store', () => {
    const me = { lat: 40, lon: -100 };
    const idx = new StoreIndex([[39.95, -100]]); // due south
    expect(angleGap(escapeBearing(idx, me)!, 0)).toBeLessThanOrEqual(10);
  });
  it('heads for the gap between stores, not just away from the closest', () => {
    const me = { lat: 40, lon: -100 };
    // Stores north, south and west: the open side is east.
    const idx = new StoreIndex([[40.05, -100], [39.95, -100], [40, -100.07]]);
    expect(angleGap(escapeBearing(idx, me)!, 90)).toBeLessThanOrEqual(20);
  });
  it('is null with no stores', () => expect(escapeBearing(new StoreIndex([]), { lat: 0, lon: 0 })).toBeNull());
  it('bearingDeg: due east is 90', () => expect(Math.round(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }))).toBe(90));
});

describe('escapeBearing on real store data', () => {
  const real = new StoreIndex(require('../../../assets/data/stores.json').points);
  const angleGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  it('east Altadena points north into the San Gabriels, not away from the nearest store (NW)', () => {
    // Field report 2026-11-26: nearest store ~1 mi SE, mountains due north.
    const e = escapeBearing(real, { lat: 34.18, lon: -118.11 })!;
    expect(angleGap(e, 0)).toBeLessThanOrEqual(30);
  });
});
