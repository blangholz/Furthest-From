import { edgePoint, edgeTables } from '../edge';

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('edgePoint', () => {
  it('hits the middle of each side', () => {
    const W = 180, H = 400, r = 50;
    close(edgePoint(0, W, H, r).y, -H);
    close(edgePoint(90, W, H, r).x, W);
    close(edgePoint(180, W, H, r).y, H);
    close(edgePoint(270, W, H, r).x, -W);
  });
  it('lands on the corner arc, inside the sharp corner', () => {
    const W = 180, H = 400, r = 50;
    const deg = (Math.atan2(W, H) * 180) / Math.PI; // straight at the sharp corner
    const p = edgePoint(deg, W, H, r);
    const dist = Math.hypot(p.x - (W - r), p.y + (H - r));
    close(dist, r);
    expect(p.x).toBeLessThan(W);
    expect(-p.y).toBeLessThan(H);
  });
  it('matches a sharp rectangle with r = 0', () => {
    const p = edgePoint(45, 100, 100, 0);
    close(p.x, 100);
    close(p.y, -100);
  });
});

describe('edgeTables', () => {
  it('is strictly increasing and spans both ends', () => {
    const t = edgeTables(180, 400, 50);
    const xs = t.x.inputRange;
    expect(xs[0]).toBe(-720);
    expect(xs[xs.length - 1]).toBe(720);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });
});
