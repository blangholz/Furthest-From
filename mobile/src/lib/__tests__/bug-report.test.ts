jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
import { base64ToBytes, feedShake, newShakeState, SHAKE } from '../bug-report';

const rest = { x: 0, y: 0, z: -1 };
const jolt = { x: 2.6, y: 0.4, z: -1 };

describe('feedShake', () => {
  it('ignores a phone at rest and normal handling', () => {
    const st = newShakeState();
    for (let t = 0; t < 3000; t += 50) expect(feedShake(st, t % 200 ? rest : { x: 0.8, y: 0.3, z: -1.2 }, t)).toBe(false);
  });

  it('fires once on a quick back-and-forth shake, then cools down', () => {
    const st = newShakeState();
    const fired: number[] = [];
    for (let t = 0; t < 2000; t += 50) if (feedShake(st, t % 150 === 0 ? jolt : rest, t)) fired.push(t);
    expect(fired).toEqual([450]); // 4th jolt at 0,150,300,450; the rest falls in the cooldown
    expect(feedShake(st, jolt, 450 + SHAKE.cooldownMs - 1)).toBe(false);
  });

  it('does not count one long bump as several jolts', () => {
    const st = newShakeState();
    for (let t = 0; t < 300; t += 20) expect(feedShake(st, jolt, t)).toBe(false);
  });

  it('needs the jolts close together', () => {
    const st = newShakeState();
    for (let t = 0; t < 6000; t += 600) expect(feedShake(st, jolt, t)).toBe(false);
  });
});

describe('base64ToBytes', () => {
  it.each(['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'])('decodes %p', (s) => {
    const b64 = Buffer.from(s).toString('base64');
    expect(Buffer.from(base64ToBytes(b64)).toString()).toBe(s);
  });
  it('decodes binary and ignores line breaks', () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 256);
    const b64 = Buffer.from(bytes).toString('base64').replace(/(.{76})/g, '$1\n');
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
  });
});
