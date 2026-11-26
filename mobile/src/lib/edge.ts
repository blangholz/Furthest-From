// Geometry for the edge compass: where a ray from the screen's center, at angle θ
// (degrees clockwise from screen-up), crosses a rounded rectangle that hugs the display.
// Pure functions so they're testable; EdgeCompass turns them into interpolate tables.
import { Platform } from 'react-native';

/** Offset from center (x right, y down) where the ray hits a W x H half-size rect with corner radius r. */
export function edgePoint(deg: number, W: number, H: number, r: number): { x: number; y: number } {
  const t = (deg * Math.PI) / 180;
  const dx = Math.sin(t);
  const dy = -Math.cos(t);
  const k = Math.min(Math.abs(dx) < 1e-9 ? Infinity : W / Math.abs(dx), Math.abs(dy) < 1e-9 ? Infinity : H / Math.abs(dy));
  const x = dx * k;
  const y = dy * k;
  r = Math.max(0, Math.min(r, W, H));
  if (r === 0 || Math.abs(x) <= W - r || Math.abs(y) <= H - r) return { x, y };
  // In a corner: intersect with the corner circle instead, taking the far root.
  const cx = Math.sign(x) * (W - r);
  const cy = Math.sign(y) * (H - r);
  const b = dx * cx + dy * cy;
  const c = cx * cx + cy * cy - r * r;
  const s = b + Math.sqrt(Math.max(0, b * b - c));
  return { x: dx * s, y: dy * s };
}

/**
 * Interpolate tables (angle -> x, angle -> y) over -span..span degrees. Sampled every 2 degrees,
 * and every 0.25 degrees where the ray hits a rounded corner so the curve stays smooth.
 */
export function edgeTables(W: number, H: number, r: number, span = 720) {
  const turn = new Set<number>();
  for (let a = 0; a < 360; a += 2) turn.add(a);
  // Angles where the ray enters / leaves the top-right corner zone, mirrored to all four.
  const a1 = (Math.atan2(W - r, H) * 180) / Math.PI;
  const a2 = (Math.atan2(W, H - r) * 180) / Math.PI;
  for (const [lo, hi] of [[a1, a2], [180 - a2, 180 - a1], [180 + a1, 180 + a2], [360 - a2, 360 - a1]])
    for (let a = lo; a <= hi + 1e-9; a += 0.25) turn.add(Math.round(a * 1000) / 1000);
  const one = [...turn].filter((a) => a >= 0 && a < 360).sort((p, q) => p - q);
  const inputRange: number[] = [];
  for (let off = -span; off < span; off += 360) for (const a of one) inputRange.push(a + off);
  inputRange.push(span);
  const pts = inputRange.map((a) => edgePoint(a, W, H, r));
  return {
    x: { inputRange, outputRange: pts.map((p) => p.x) },
    y: { inputRange, outputRange: pts.map((p) => p.y) },
  };
}

/**
 * Best guess at the display's corner radius in points. iOS doesn't expose it publicly;
 * Face ID iPhones (bottom inset > 0) sit around 0.14 x width (39 to 62 pt), home-button
 * models are square. Android varies by maker, so a modest default.
 */
export function displayCornerRadius(width: number, bottomInset: number): number {
  if (Platform.OS === 'ios') return bottomInset > 0 ? Math.round(width * 0.14) : 0;
  if (Platform.OS === 'android') return Math.round(width * 0.08);
  return 0;
}
