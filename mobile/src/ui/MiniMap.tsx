// An abstract map right under the "You are currently" box, filling its own box edge to edge; the root test page's dot map redrawn in
// the Field Notes style. No tiles or roads: thin ruled grid lines, an ink dot per McDonald's,
// a crosshair for you and a dashed line to the nearest. It opens zoomed so the nearest store
// (or, in town, the six nearest) sits well inside; pinch or tap + / − to zoom, FIT to reset.
// Zoom is about you, the center. Drawn with plain Views (no SVG dependency), all on the phone.
// With a compass heading the drawing turns about you so up is the way you face, in step with
// the edge compass; the N rides the rim. Dots and grid are drawn past the frame's corners so a
// turned map never shows empty corners.
import { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePinchGesture } from 'react-native-gesture-handler';
import { haversineMi, type LatLon, type Store } from '@/lib/geo';
import { binPoints, clampSpan, clipSegment, dashes, fitSpanMi, gridLines, nearProjection, type Pt } from '@/lib/minimap';
import { storeIndex } from '@/lib/stores';
import { useSmoothAngle } from './EdgeCompass';
import { Small } from './kit';
import { colors, fonts, space, stroke } from './theme';

const DOT = 6;
const BIN_DOT = 4; // smaller dots once a zoomed-out view gets thinned
const BIN_AT = 250; // more dots than this get binned to one per BIN_CELL px
const BIN_CELL = 5;
const CROSS = 14;
const FIT = 6;
const FIT_MAX_MI = 15;
const STEP = 2; // + / − zoom factor

export function MiniMap({ pos, nearest, heading = null }: {
  pos: LatLon | null; nearest: { store: Store; mi: number } | null; heading?: number | null;
}) {
  const [w, setW] = useState(0);
  // A Card-style outline with no label or padding: the map is the whole box.
  return (
    <View style={s.box} onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width) - 2 * stroke)}>
      {w > 0 && pos && nearest ? <NearMap w={w} pos={pos} nearest={nearest} heading={heading} /> : (
        <View style={s.waiting}><Small>Finding you…</Small></View>
      )}
    </View>
  );
}

function NearMap({ w, pos, nearest, heading }: { w: number; pos: LatLon; nearest: { store: Store; mi: number }; heading: number | null }) {
  // Default zoom fits the nearest, and in towns widens to about the FIT nearest stores.
  const fit = useMemo(() => {
    const close = storeIndex().within(pos, FIT_MAX_MI, FIT);
    return fitSpanMi(Math.max(nearest.mi, close.length ? haversineMi(pos, close[close.length - 1]) * 0.75 : 0));
  }, [pos, nearest.mi]);
  // Zoom is kept relative to the fit, so it follows you as the nearest store changes.
  const [zoom, setZoom] = useState(1);
  const spanMi = clampSpan(fit / zoom);
  const zoomTo = (spanWanted: number) => setZoom(fit / clampSpan(spanWanted));

  const proj = useMemo(() => nearProjection(pos, spanMi, w), [pos, spanMi, w]);
  // Draw out to the frame's half-diagonal on every side, so turning never uncovers a corner.
  const pad = Math.ceil(Math.hypot(proj.w, proj.h) / 2 - proj.h / 2);
  const inPad = (p: Pt) => p.x >= -pad && p.y >= -pad && p.x <= proj.w + pad && p.y <= proj.h + pad;
  const dots = useMemo(() => {
    const pts = storeIndex()
      .within(pos, proj.spanMi * 0.7, 4000)
      .map((s) => proj.project(s))
      .filter(inPad);
    if (pts.length <= BIN_AT) return { pts, size: DOT };
    const shifted = pts.map((p) => ({ x: p.x + pad, y: p.y + pad }));
    const binned = binPoints(shifted, proj.w + 2 * pad, proj.h + 2 * pad, BIN_CELL).map((p) => ({ x: p.x - pad, y: p.y - pad }));
    return { pts: binned, size: BIN_DOT };
  }, [pos, proj, pad]);
  const me = proj.project(pos);
  const store = proj.project(nearest.store);
  const storeOn = inPad(store);
  const shift = (p: Pt, d: number) => ({ x: p.x + d, y: p.y + d });
  const clipped = clipSegment(shift(me, pad), shift(store, pad), proj.w + 2 * pad, proj.h + 2 * pad);
  const line = clipped ? ([shift(clipped[0], -pad), shift(clipped[1], -pad)] as [Pt, Pt]) : null;
  const stepPx = (proj.gridMi * proj.w) / proj.spanMi;
  const grid = (mid: number, size: number) => gridLines(mid + pad, stepPx, size + 2 * pad).map((v) => v - pad);

  // Heading-up: turn the drawing about you (the center) by -heading; labels counter-turn.
  const turn = useSmoothAngle(heading == null ? null : -heading);
  const rotate = turn.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });
  const upright = turn.interpolate({ inputRange: [-720, 720], outputRange: ['720deg', '-720deg'] });
  const nR = proj.h / 2 - 12; // N sits just inside the rim, due north of you

  // Pinch: scale the drawing live (cheap), then redraw at the new zoom when the fingers lift.
  const live = useRef(new Animated.Value(1)).current;
  const pinch = usePinchGesture({
    runOnJS: true,
    onUpdate: (e) => live.setValue(spanMi / clampSpan(spanMi / e.scale)),
    onDeactivate: (e) => {
      zoomTo(spanMi / e.scale);
      live.setValue(1);
    },
  });

  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={pinch}>
        <View style={[s.frame, { width: proj.w, height: proj.h }]} accessible
          accessibilityLabel={`Map of McDonald's near you, ${fmtMi(proj.spanMi)} miles across${heading != null ? ', turned to the way you face' : ''}`}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: live }, { rotate }] }]}>
            {grid(me.x, proj.w).map((x) => <View key={`x${x}`} style={[s.vline, { left: x }]} />)}
            {grid(me.y, proj.h).map((y) => <View key={`y${y}`} style={[s.hline, { top: y }]} />)}
            {dots.pts.map((p, i) => <Dot key={i} p={p} size={dots.size} />)}
            {line ? dashes(line[0], line[1]).map((d, i) => (
              <View key={`d${i}`} style={[s.dash, { left: d.x - d.len / 2, top: d.y - 0.5, width: d.len, transform: [{ rotate: `${d.deg}deg` }] }]} />
            )) : null}
            {storeOn ? <View style={[s.ring, { left: store.x - 7, top: store.y - 7 }]} /> : null}
            <Crosshair p={me} />
            {heading != null ? (
              <Animated.Text style={[s.nRim, { left: me.x - 9, top: me.y - nR - 9, transform: [{ rotate: upright }] }]}>N</Animated.Text>
            ) : null}
          </Animated.View>
          {heading == null ? <Text style={s.n}>N</Text> : null}
          <View style={s.scale}>
            <View style={[s.scaleBar, { width: stepPx }]} />
            <Text style={s.mapText}>{fmtMi(proj.gridMi)} mi</Text>
          </View>
          <View style={s.zoom}>
            {zoom !== 1 ? <ZoomButton label="Fit" a11y="Zoom to fit" onPress={() => setZoom(1)} /> : null}
            <ZoomButton label="−" a11y="Zoom out" onPress={() => zoomTo(spanMi * STEP)} />
            <ZoomButton label="+" a11y="Zoom in" onPress={() => zoomTo(spanMi / STEP)} />
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const fmtMi = (mi: number) => (mi >= 10 ? String(Math.round(mi)) : String(Number(mi.toFixed(1))));

function ZoomButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const wide = label.length > 1;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [s.zoomBtn, wide && s.zoomWide, pressed && s.zoomPressed]}>
      {({ pressed }) => <Text style={[s.zoomText, wide && s.zoomTextSmall, pressed && { color: colors.bg }]}>{label}</Text>}
    </Pressable>
  );
}

const Dot = ({ p, size }: { p: Pt; size: number }) => (
  <View style={[s.dot, { left: p.x - size / 2, top: p.y - size / 2, width: size, height: size, borderRadius: size / 2 }]} />
);

/** You: a thin ink cross with a small open square at the middle. */
const Crosshair = ({ p }: { p: Pt }) => (
  <View pointerEvents="none" style={[s.cross, { left: p.x - CROSS, top: p.y - CROSS }]}>
    <View style={s.crossH} />
    <View style={s.crossV} />
    <View style={s.crossBox} />
  </View>
);

const s = StyleSheet.create({
  box: { borderWidth: stroke, borderColor: colors.ink, overflow: 'hidden' },
  waiting: { paddingHorizontal: space.lg, paddingVertical: space.md },
  frame: { overflow: 'hidden' },
  // Grid lines overhang the frame so they still reach the edges while a pinch shrinks the drawing.
  vline: { position: 'absolute', top: -2000, bottom: -2000, width: StyleSheet.hairlineWidth, backgroundColor: colors.muted, opacity: 0.45 },
  hline: { position: 'absolute', left: -2000, right: -2000, height: StyleSheet.hairlineWidth, backgroundColor: colors.muted, opacity: 0.45 },
  dot: { position: 'absolute', backgroundColor: colors.ink },
  dash: { position: 'absolute', height: 1, backgroundColor: colors.ink },
  ring: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ink },
  cross: { position: 'absolute', width: CROSS * 2, height: CROSS * 2, alignItems: 'center', justifyContent: 'center' },
  crossH: { position: 'absolute', width: CROSS * 2, height: 1.5, backgroundColor: colors.ink },
  crossV: { position: 'absolute', width: 1.5, height: CROSS * 2, backgroundColor: colors.ink },
  crossBox: { width: 8, height: 8, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.bg },
  n: { ...fonts.condensed, position: 'absolute', top: 4, left: 6, fontSize: 13, color: colors.ink },
  nRim: { ...fonts.condensed, position: 'absolute', width: 18, height: 18, lineHeight: 18, textAlign: 'center', fontSize: 13,
    color: colors.ink, backgroundColor: colors.bg },
  scale: { position: 'absolute', left: 6, bottom: 4, gap: 2 },
  scaleBar: { height: 4, borderWidth: 1, borderTopWidth: 0, borderColor: colors.ink },
  mapText: { ...fonts.alternate, fontSize: 10, letterSpacing: 1, color: colors.ink },
  zoom: { position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', gap: 6 },
  zoomBtn: { width: 32, height: 32, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  zoomWide: { width: 44 },
  zoomPressed: { backgroundColor: colors.ink },
  zoomText: { ...fonts.condensed, fontSize: 22, lineHeight: 26, marginTop: 4, color: colors.ink },
  zoomTextSmall: { fontSize: 14, lineHeight: 18, marginTop: 2 },
});
