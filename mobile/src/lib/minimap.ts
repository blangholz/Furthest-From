// Pure layout math for the Vicinity map on Home (ui/MiniMap): a flat projection centered on
// you, a "nice" grid step, zoom limits, and thinning dense dot clouds to one dot per few pixels
// so they can be drawn with plain Views. Same idea as the root index.html test page's canvas map.
import type { LatLon } from './geo';

const MI_PER_DEG = 69;
const toRad = (d: number) => (d * Math.PI) / 180;

export type Pt = { x: number; y: number };
export type Projection = { w: number; h: number; project: (p: LatLon) => Pt; spanMi: number; gridMi: number };

/** Zoom limits, as miles across the map. */
export const MIN_SPAN_MI = 0.5;
export const MAX_SPAN_MI = 300;
export const clampSpan = (mi: number) => Math.min(MAX_SPAN_MI, Math.max(MIN_SPAN_MI, mi));

/** 1, 2 or 5 times a power of ten, the largest one at or below `x`. */
export function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

/**
 * Default zoom, in miles across: wide enough that `fitMi` sits well inside (the test page's
 * "zoom to me": 2.6x the nearest distance, at least 3 mi), also fitting vertically.
 */
export function fitSpanMi(fitMi: number, aspect = 0.75): number {
  return clampSpan(Math.max(3, (fitMi * 2.6) / aspect));
}

/** Map `spanMi` miles across, centered on you; `h` comes from the aspect ratio. */
export function nearProjection(center: LatLon, spanMi: number, w: number, aspect = 0.75): Projection {
  const h = Math.round(w * aspect);
  const k = w / spanMi; // px per mile
  const c = Math.cos(toRad(center.lat));
  return {
    w,
    h,
    spanMi,
    gridMi: niceStep(spanMi / 4),
    project: (p) => ({
      x: w / 2 + (p.lon - center.lon) * MI_PER_DEG * c * k,
      y: h / 2 - (p.lat - center.lat) * MI_PER_DEG * k,
    }),
  };
}

/** One point per occupied `cell`-pixel square (its center), dropping anything off the map. */
export function binPoints(points: Pt[], w: number, h: number, cell: number): Pt[] {
  const seen = new Set<number>();
  const out: Pt[] = [];
  const cols = Math.ceil(w / cell);
  for (const { x, y } of points) {
    if (x < 0 || y < 0 || x > w || y > h) continue;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const key = cy * cols + cx;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x: (cx + 0.5) * cell, y: (cy + 0.5) * cell });
  }
  return out;
}

/** Positions of the grid lines (px), every `stepPx` outward from `mid` both ways, inside 0..size. */
export function gridLines(mid: number, stepPx: number, size: number): number[] {
  if (!(stepPx > 2)) return [];
  const out: number[] = [];
  const first = mid - Math.floor(mid / stepPx) * stepPx;
  for (let v = first; v <= size; v += stepPx) out.push(v);
  return out;
}

/** Short dashes from a to b, as center + length + angle for rotated Views. */
export function dashes(a: Pt, b: Pt, dash = 6, gap = 5): { x: number; y: number; len: number; deg: number }[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [];
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const out = [];
  for (let t = 0; t < len; t += dash + gap) {
    const l = Math.min(dash, len - t);
    const m = (t + l / 2) / len;
    out.push({ x: a.x + dx * m, y: a.y + dy * m, len: l, deg });
  }
  return out;
}

/** The part of segment a→b inside the 0..w × 0..h box (Liang–Barsky), or null if none of it is. */
export function clipSegment(a: Pt, b: Pt, w: number, h: number): [Pt, Pt] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [[-dx, a.x], [dx, w - a.x], [-dy, a.y], [dy, h - a.y]];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  return [{ x: a.x + dx * t0, y: a.y + dy * t0 }, { x: a.x + dx * t1, y: a.y + dy * t1 }];
}
