// Edge compass: dots and a tiny N that ride the screen's margin, in the gutter around the
// cards. Each dot is a McDonald's within RADIUS_MI (plus the nearest, however far), placed
// where a line from the middle of the screen toward it would cross the margin; farther
// ones fade out. The N does the same for true north, and a
// small arrow on the margin points the way to walk to get farther from McDonald's. Turn the
// phone and everything slides round the edge.
// Hidden without a compass heading (simulator, web): a north-up guess would just be wrong.
// The track follows the display's rounded corners (radius estimated, see lib/edge.ts) and
// runs up beside the status bar. Positions are precomputed as interpolate tables so all movement runs on the native driver.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayCornerRadius, edgeTables } from '@/lib/edge';
import { colors, space } from './theme';

export const RADIUS_MI = 5;
const DOT = 8;
const N_BOX = 14;
const ARROW_W = 10;
const ARROW_H = 10;
const INSET = space.lg / 2; // middle of the screen gutter
const SPAN = 720; // table covers -SPAN..SPAN so unwrapped angles never fall off the end

/** Unwrapped, smoothed angle (degrees, clockwise from screen-up) following `deg` the short way round. */
function useAngle(deg: number | null) {
  const v = useRef(new Animated.Value(0)).current;
  const shown = useRef<number | null>(null);
  useEffect(() => {
    if (deg == null) return;
    if (shown.current == null) {
      shown.current = deg;
      v.setValue(deg);
      return;
    }
    let cur = shown.current;
    if (Math.abs(cur) > 360) {
      cur = ((cur % 360) + 360) % 360; // same spot on screen, keeps us inside the table
      v.setValue(cur);
    }
    const next = cur + ((((deg - cur) % 360) + 540) % 360) - 180;
    shown.current = next;
    Animated.timing(v, { toValue: next, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [deg, v]);
  return v;
}

export type EdgeStore = { key: string; bearing: number; mi: number };
type Geo = { cx: number; cy: number; t: ReturnType<typeof edgeTables> };

function place(geo: Geo, v: Animated.Value, size: number) {
  return {
    left: geo.cx - size / 2,
    top: geo.cy - size / 2,
    transform: [{ translateX: v.interpolate(geo.t.x) }, { translateY: v.interpolate(geo.t.y) }],
  };
}

/** Nearest is solid; fades linearly to 0.2 at the edge of the radius. */
const fade = (mi: number) => Math.max(0.2, 1 - 0.8 * Math.min(1, mi / RADIUS_MI));

function StoreDot({ geo, store, heading }: { geo: Geo; store: EdgeStore; heading: number }) {
  const v = useAngle(store.bearing - heading);
  return (
    <Animated.View style={[s.dot, { opacity: fade(store.mi) }, place(geo, v, DOT)]} />
  );
}

/** Small triangle on the margin, rotated to point outward along the escape direction. */
function EscapeArrow({ geo, bearing, heading }: { geo: Geo; bearing: number; heading: number }) {
  const v = useAngle(bearing - heading);
  const rotate = v.interpolate({ inputRange: [-SPAN, SPAN], outputRange: [`${-SPAN}deg`, `${SPAN}deg`] });
  const p = place(geo, v, ARROW_W);
  return (
    <Animated.View style={[s.arrowBox, { left: p.left, top: geo.cy - ARROW_H / 2, transform: [...p.transform, { rotate }] }]}>
      <View style={s.arrow} />
    </Animated.View>
  );
}

/** `stores` should be sorted farthest first so the nearest draws on top. */
export function EdgeCompass({ stores, escape, heading }: { stores: EdgeStore[]; escape: number | null; heading: number | null }) {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const north = useAngle(heading != null ? -heading : null);

  // The track hugs the physical display, rounded corners included, INSET in from the glass.
  const geo = useMemo(() => {
    if (!box) return null;
    const W = box.w / 2 - INSET;
    const H = box.h / 2 - INSET;
    const r = Math.max(0, displayCornerRadius(box.w, insets.bottom) - INSET);
    return { cx: box.w / 2, cy: box.h / 2, t: edgeTables(W, H, r, SPAN) };
  }, [box, insets.bottom]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {geo && heading != null ? (
        <>
          {stores.map((st) => <StoreDot key={st.key} geo={geo} store={st} heading={heading} />)}
          {escape != null ? <EscapeArrow geo={geo} bearing={escape} heading={heading} /> : null}
          <Animated.Text style={[s.n, place(geo, north, N_BOX)]}>N</Animated.Text>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  arrowBox: { position: 'absolute', width: ARROW_W, height: ARROW_H, alignItems: 'center', justifyContent: 'center' },
  // CSS-border triangle pointing up (sharp, flat print look).
  arrow: { width: 0, height: 0, borderLeftWidth: ARROW_W / 2, borderRightWidth: ARROW_W / 2, borderBottomWidth: ARROW_H,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.ink },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.ink },
  n: {
    position: 'absolute', width: N_BOX, height: N_BOX, lineHeight: N_BOX, textAlign: 'center',
    fontSize: 11, fontWeight: '800', color: colors.ink,
  },
});
