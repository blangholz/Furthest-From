import { formatLatLon } from '../format';

describe('formatLatLon', () => {
  it('writes GPS-style coordinates with hemispheres', () => {
    expect(formatLatLon({ lat: 43.58841, lon: -118.95123 })).toBe('43.5884° N, 118.9512° W');
    expect(formatLatLon({ lat: -33.8688, lon: 151.2093 })).toBe('33.8688° S, 151.2093° E');
  });
});
