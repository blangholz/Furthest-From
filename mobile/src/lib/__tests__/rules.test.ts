import { addCredits, classify, creditsFor, roughlyLower48, seasonName, streakFrom, todaysPingWindow, pointsFor } from '../rules';

const RENO = { lat: 39.5296, lon: -119.8138 };

describe('classify', () => {
  it('home zone is 5 miles', () => {
    expect(classify({ lat: 39.58, lon: -119.8 }, RENO, true)).toBe('home');
    expect(classify({ lat: 39.7, lon: -119.8 }, RENO, true)).toBe('scoring');
  });
  it('outside the lower 48 is a Passport stamp', () => expect(classify({ lat: 64.1, lon: -21.9 }, RENO, false)).toBe('passport'));
  it('only scoring logs earn points', () => {
    expect(pointsFor('scoring', 63.24)).toBe(63.24);
    expect(pointsFor('passport', 512)).toBe(0);
  });
});

describe('roughlyLower48', () => {
  it.each([
    ['Austin NV', 39.49, -117.07, true],
    ['Key West', 24.56, -81.78, true],
    ['Toronto', 43.65, -79.38, false],
    ['Anchorage', 61.2, -149.9, false],
    ['Detroit', 42.33, -83.05, true],
  ])('%s', (_n, lat, lon, want) => expect(roughlyLower48({ lat, lon })).toBe(want));
});

describe('Extra Fries', () => {
  it('7 credits make one', () => expect(addCredits(6, 1)).toEqual({ earned: 1, remaining: 0 }));
  it('double credit from a 12 streak', () => {
    expect(creditsFor(11)).toBe(1);
    expect(creditsFor(12)).toBe(2);
    expect(addCredits(6, 2)).toEqual({ earned: 1, remaining: 1 });
  });
});

describe('streakFrom', () => {
  it('counts qualifying pings, pauses on home, stops at a miss', () => {
    expect(
      streakFrom([
        { status: 'logged', zone: 'scoring' },
        { status: 'logged', zone: 'home' },
        { status: 'logged', zone: 'passport' },
        { status: 'missed' },
        { status: 'logged', zone: 'scoring' },
      ]),
    ).toBe(2);
  });
});

describe('seasonName', () => {
  it('names seasons like the server', () => {
    expect(seasonName(new Date('2026-11-12T20:00:00Z'))).toBe('Fall 2026');
    expect(seasonName(new Date('2027-01-05T20:00:00Z'))).toBe('Winter 2026-27');
    expect(seasonName(new Date('2026-12-01T09:00:00Z'))).toBe('Winter 2026-27');
  });
});

it('ping window is 1:20 to 2:20 PM local', () => {
  const w = todaysPingWindow(new Date(2026, 10, 12, 9, 0));
  expect(w.opensAt.getHours()).toBe(13);
  expect(w.opensAt.getMinutes()).toBe(20);
  expect(w.closesAt.getTime() - w.opensAt.getTime()).toBe(3600_000);
});
