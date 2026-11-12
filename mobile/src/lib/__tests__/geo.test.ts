import { haversineMi, StoreIndex, formatMiles } from '../geo';

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
