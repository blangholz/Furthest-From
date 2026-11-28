// Full-size radar (parked: was on Home, swapped for the subtle EdgeCompass on 2026-11-26).
// Drop <FullSizeRadar size you store heading /> back in to bring it up again.
// you at the center with a pulsing blip, a sweep arm, and
// a dashed line out to the nearest McDonald's (an ink square) along its real compass bearing.
// The store always sits at the same radius; the big number above is the scale.
// With a compass heading the whole dial turns so N points at real north; labels
// counter-rotate to stay upright, and a fixed tick at the top marks where you face.
// Plain RN Animated with the native driver, so it costs nothing on the JS thread.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { bearingDeg, type LatLon } from '@/lib/geo';
import { colors } from './theme';

const SWEEP_MS = 6000; // calm, old-school sweep (4s felt frantic, 8s too slow)
const PULSE_MS = 3000;
const ECHO = 84; // diameter of the ring that radiates from the store on each pass
// Built-in condensed faces, no font download.
const CONDENSED = Platform.select({ ios: 'DIN Condensed', android: 'sans-serif-condensed', default: undefined });
const STORE = 12; // store marker, centered on the store point
const STORE_AT = 0.72; // fraction of the radius where the store blip sits
const DASH = 6;
const GAP = 5;

const toRad = (d: number) => (d * Math.PI) / 180;

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compassPoint = (deg: number) => POINTS[Math.round(deg / 22.5) % 16];

/** Signed decimal degrees, GPS style: "40.71280" / "-74.00600". */
export function formatCoord(p: LatLon, sep = '  '): string {
  return `${p.lat.toFixed(5)}${sep}${p.lon.toFixed(5)}`;
}

function useLoop(ms: number, easing = Easing.linear) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [v, ms, easing]);
  return v;
}

/**
 * A value driven by the sweep that snaps to `hit` as the arm passes the store
 * (f = bearing / 360), eases to `rest` over `span` of a turn, and holds `rest`
 * until the next pass. Built as interpolate ranges so it runs on the native driver.
 */
function afterPass(f: number, span: number, hit: number, rest: number) {
  const at = (x: number) => {
    const d = (((x - f) % 1) + 1) % 1;
    return d >= span ? rest : hit + (rest - hit) * (d / span);
  };
  const before = (f - 0.0005 + 1) % 1; // just before the arm arrives
  const xs = [0, 1, f, before, (f + span) % 1];
  const inputRange = [...new Set(xs)].sort((a, b) => a - b);
  const outputRange = inputRange.map((x) => (x === before ? rest : at(x)));
  return { inputRange, outputRange };
}

/** Smoothly rotates toward -heading along the shortest way round (no 359->0 spin). */
function useDialRotation(heading: number | null) {
  const v = useRef(new Animated.Value(0)).current;
  const shown = useRef(0);
  useEffect(() => {
    const target = heading == null ? 0 : -heading;
    const next = shown.current + ((((target - shown.current) % 360) + 540) % 360) - 180;
    shown.current = next;
    Animated.timing(v, { toValue: next, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [heading, v]);
  const dial = v.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'], extrapolate: 'extend' });
  const upright = v.interpolate({ inputRange: [-360, 360], outputRange: ['360deg', '-360deg'], extrapolate: 'extend' });
  return { dial, upright };
}

export function FullSizeRadar({ size, you, store, heading = null }: {
  size: number; you: LatLon | null; store: LatLon | null; heading?: number | null;
}) {
  const sweep = useLoop(SWEEP_MS);
  const pulse = useLoop(PULSE_MS, Easing.out(Easing.quad));
  const r = size / 2;
  const bearing = you && store ? bearingDeg(you, store) : null;
  const { dial, upright } = useDialRotation(heading);
  const echo = useMemo(() => {
    if (bearing == null) return null;
    const f = bearing / 360;
    return {
      glow: sweep.interpolate(afterPass(f, 0.6, 1, 0.35)),
      ringScale: sweep.interpolate(afterPass(f, 0.3, 0.2, 1)),
      ringOpacity: sweep.interpolate(afterPass(f, 0.3, 0.9, 0)),
    };
  }, [bearing, sweep]);

  const lineLen = r * STORE_AT;
  const dashes = Math.max(1, Math.floor((lineLen - 16) / (DASH + GAP))); // stop short of the store marker
  const sx = bearing == null ? 0 : r + Math.sin(toRad(bearing)) * lineLen;
  const sy = bearing == null ? 0 : r - Math.cos(toRad(bearing)) * lineLen;

  const arm = (lagDeg: number) =>
    sweep.interpolate({ inputRange: [0, 1], outputRange: [`${-90 - lagDeg}deg`, `${270 - lagDeg}deg`] });

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={
      bearing == null ? 'Radar, finding you' : `Nearest McDonald's is ${compassPoint(bearing)} of you, at ${store ? formatCoord(store, ', ') : ''}`}>
      {heading != null ? <View style={[s.facing, { left: r - 1, top: -42 }]} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: dial }] }]}>
      {[1, 0.66, 0.33].map((k) => (
        <View key={k} style={[s.ring, { width: size * k, height: size * k, borderRadius: (size * k) / 2,
          left: r - (size * k) / 2, top: r - (size * k) / 2 }]} />
      ))}
      <View style={[s.cross, { left: 0, top: r, width: size, height: StyleSheet.hairlineWidth }]} />
      <View style={[s.cross, { left: r, top: 0, width: StyleSheet.hairlineWidth, height: size }]} />
      <Animated.Text style={[s.north, { left: r - 12, top: -30, transform: [{ rotate: upright }] }]}>N</Animated.Text>

      {[12, 6, 0].map((lag, i) => (
        <Animated.View key={lag} style={[s.arm, { left: r, top: r - 1, width: r, opacity: [0.12, 0.25, 0.85][i],
          transform: [{ rotate: arm(lag) }] }]} />
      ))}

      {bearing != null ? (
        <View style={[s.line, { left: r, top: r - 1, width: lineLen, transform: [{ rotate: `${bearing - 90}deg` }] }]}>
          {Array.from({ length: dashes }, (_, i) => (
            <View key={i} style={[s.dash, { left: 8 + i * (DASH + GAP) }]} />
          ))}
        </View>
      ) : null}

      {echo ? (
        <>
          <Animated.View style={[s.echo, { left: sx - ECHO / 2, top: sy - ECHO / 2, opacity: echo.ringOpacity,
            transform: [{ scale: echo.ringScale }] }]} />
          {/* The store: a solid ink square, like a survey marker. It brightens as the sweep passes. */}
          <Animated.View style={[s.store, { left: sx - STORE / 2, top: sy - STORE / 2, opacity: echo.glow }]} />
        </>
      ) : null}
      </Animated.View>

      <Animated.View style={[s.pulse, { left: r - 30, top: r - 30,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }]} />
      <View style={[s.you, { left: r - 6, top: r - 6 }]} />
    </View>
  );
}

const s = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1, borderColor: colors.ink, opacity: 0.35 },
  cross: { position: 'absolute', backgroundColor: colors.ink, opacity: 0.25 },
  north: { position: 'absolute', width: 24, height: 26, lineHeight: 26, textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.ink, fontFamily: CONDENSED },
  arm: { position: 'absolute', height: 2, backgroundColor: colors.ink, transformOrigin: 'left center' },
  line: { position: 'absolute', height: 2, transformOrigin: 'left center' },
  dash: { position: 'absolute', top: 0, width: DASH, height: 2, backgroundColor: colors.ink },
  store: { position: 'absolute', width: STORE, height: STORE, backgroundColor: colors.ink },
  echo: { position: 'absolute', width: ECHO, height: ECHO, borderRadius: ECHO / 2, borderWidth: 1, borderColor: colors.ink },
  facing: { position: 'absolute', width: 2, height: 10, backgroundColor: colors.ink },
  pulse: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.ink },
  you: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.ink },
});
