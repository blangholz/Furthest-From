import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { LatLon } from './geo';

// "While Using the App" only. No background location, ever.
export async function ensureForegroundPermission(): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

/** One accurate fix, for logging a ping, using Extra Fries or claiming a spot. */
export async function currentFix(): Promise<LatLon & { accuracyM: number | null }> {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyM: pos.coords.accuracy ?? null };
}

/** Live position while the app is open and in the foreground (for the big distance number). */
export function useLiveLocation(enabled: boolean) {
  const [pos, setPos] = useState<(LatLon & { accuracyM: number | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !active) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      if (!(await ensureForegroundPermission())) {
        setError('Location is off for McFarthest. Turn it on in Settings to see your distance.');
        return;
      }
      setError(null);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 5000 },
        (p) => setPos({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy ?? null }),
      );
      if (cancelled) sub.remove();
    })().catch((e) => setError(String(e?.message ?? e)));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, active]);

  return { pos, error };
}

/**
 * Compass heading (degrees clockwise from true north, magnetic if true is unavailable)
 * while the app is in the foreground. Only starts once location is already granted
 * (pass enabled once a position has arrived), so it never triggers its own prompt.
 * Updates under 2 degrees are dropped to keep re-renders down.
 */
export function useHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !active) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      if (!(await Location.getForegroundPermissionsAsync()).granted) return;
      sub = await Location.watchHeadingAsync((h) => {
        const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (deg == null || deg < 0) return;
        setHeading((prev) => {
          if (prev == null) return deg;
          const d = Math.abs(((deg - prev + 540) % 360) - 180);
          return d < 2 ? prev : deg;
        });
      });
      if (cancelled) sub.remove();
    })().catch(() => {}); // no compass (simulator, web): the radar just stays north-up
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, active]);

  return heading;
}
