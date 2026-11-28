import { binPoints, clampSpan, clipSegment, dashes, fitSpanMi, gridLines, MAX_SPAN_MI, MIN_SPAN_MI, nearProjection, niceStep } from '../minimap';

test('niceStep picks 1/2/5 steps', () => {
  expect(niceStep(0.8)).toBe(0.5);
  expect(niceStep(3)).toBe(2);
  expect(niceStep(7.9)).toBe(5);
  expect(niceStep(40)).toBe(20);
});

test('fitSpanMi is 5x the nearest distance, within zoom limits', () => {
  expect(fitSpanMi(1)).toBe(5);
  expect(fitSpanMi(10)).toBe(50);
  expect(fitSpanMi(0.01)).toBe(MIN_SPAN_MI);
  expect(fitSpanMi(500)).toBe(MAX_SPAN_MI);
});

test('nearProjection centers you and scales to the span', () => {
  const c = { lat: 40, lon: -105 };
  const p = nearProjection(c, 10, 300);
  expect(p.h).toBe(225);
  expect(p.project(c)).toEqual({ x: 150, y: 112.5 });
  expect(p.project({ lat: 40 + 1 / 69, lon: -105 }).y).toBeCloseTo(112.5 - 30); // 1 mi = 30 px
  expect(p.gridMi).toBe(2);
});

test('binPoints keeps one dot per cell and drops off-map points', () => {
  expect(binPoints([{ x: 10, y: 10 }, { x: 11, y: 11 }, { x: 500, y: 10 }], 100, 100, 5)).toEqual([{ x: 12.5, y: 12.5 }]);
});

test('gridLines run through the middle and stay in bounds', () => {
  expect(gridLines(50, 20, 100)).toEqual([10, 30, 50, 70, 90]);
  expect(gridLines(50, 0, 100)).toEqual([]);
});

test('dashes cover the line without overshooting', () => {
  const d = dashes({ x: 0, y: 0 }, { x: 20, y: 0 }, 6, 5);
  expect(d.map((x) => x.len)).toEqual([6, 6]);
  expect(d[1].x + d[1].len / 2).toBeLessThanOrEqual(20);
});

test('clipSegment trims a line to the map box', () => {
  expect(clipSegment({ x: 50, y: 50 }, { x: 5000, y: 50 }, 100, 100)).toEqual([{ x: 50, y: 50 }, { x: 100, y: 50 }]);
  expect(clipSegment({ x: 10, y: 10 }, { x: 20, y: 20 }, 100, 100)).toEqual([{ x: 10, y: 10 }, { x: 20, y: 20 }]);
  expect(clipSegment({ x: -10, y: -10 }, { x: -20, y: 50 }, 100, 100)).toBeNull();
});
