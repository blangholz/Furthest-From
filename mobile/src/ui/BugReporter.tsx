// Shake to report (Decision #42). Mounted once for testers. A shake (when the DEV
// setting is on) or "Report a bug now" grabs the screen, then opens a full-screen sheet:
// draw on the screenshot, write a note, send. The image and note go to Supabase, where
// Claude picks them up (scripts/bug-reports.mjs).
//
// Drawing is a simple in-app pen because Expo Go can't run Apple's Markup (native code).
// Once there's a development build, MarkupCanvas can be swapped for a native PencilKit
// screen; everything around it stays the same.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { usePathname } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { forwardRef, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { captureRef, captureScreen } from 'react-native-view-shot';
import { api, errorText } from '@/lib/api';
import { feedShake, newShakeState, onReportRequested, useShakeToReport } from '@/lib/bug-report';
import { Button } from './kit';
import { colors, font, fonts, space, stroke } from './theme';

type Shot = { uri: string; width: number; height: number };
type Stroke = { color: string; points: { x: number; y: number }[] };

// Pen colors that stand out on the yellow app: red first, then ink and white.
const PENS = ['#E0201B', colors.ink, '#FFFFFF'];

export function BugReporter() {
  const [shakeOn] = useShakeToReport();
  const pathname = usePathname();
  const [shot, setShot] = useState<Shot | null>(null);
  const busy = useRef(false);
  const where = useRef(pathname);
  where.current = pathname;

  const open = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const uri = await captureScreen({ format: 'jpg', quality: 0.85, result: 'tmpfile' });
      Image.getSize(uri, (width, height) => setShot({ uri, width, height }), () => setShot({ uri, width: 9, height: 19.5 }));
    } catch (e) {
      busy.current = false;
      Alert.alert("Couldn't take the screenshot", String((e as Error)?.message ?? e));
    }
  };

  useEffect(() => onReportRequested(open), []);

  useEffect(() => {
    if (!shakeOn) return;
    const state = newShakeState();
    Accelerometer.setUpdateInterval(50);
    const sub = Accelerometer.addListener((s) => {
      if (feedShake(state, s, Date.now())) open();
    });
    return () => sub.remove();
  }, [shakeOn]);

  const close = () => {
    setShot(null);
    busy.current = false;
  };

  return shot ? <ReportSheet shot={shot} route={where.current} onClose={close} /> : null;
}

function ReportSheet({ shot, route, onClose }: { shot: Shot; route: string; onClose: () => void }) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pen, setPen] = useState(PENS[0]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const canvas = useRef<ComponentRef<typeof View>>(null);

  const discard = () => {
    if (!strokes.length && !note.trim()) return onClose();
    Alert.alert('Discard this report?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  const send = async () => {
    setSending(true);
    try {
      const imageBase64 = await captureRef(canvas, { format: 'jpg', quality: 0.85, result: 'base64' });
      await api.submitBugReport({
        imageBase64,
        note: note.trim(),
        context: {
          route,
          platform: Platform.OS,
          osVersion: String(Platform.Version),
          device: Device.modelName ?? undefined,
          appVersion: Constants.expoConfig?.version,
          runtime: Constants.executionEnvironment === 'storeClient' ? 'Expo Go' : String(Constants.executionEnvironment),
          localTime: new Date().toString(),
        },
      });
      onClose();
      Alert.alert('Sent', 'Claude will pick it up next time it checks.');
    } catch (e) {
      setSending(false);
      Alert.alert("Couldn't send", errorText(e));
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={discard}>
      <SafeAreaView style={s.page} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <Pressable accessibilityRole="button" onPress={discard} hitSlop={8} style={s.headerBtn}>
              <Text style={s.headerText}>Cancel</Text>
            </Pressable>
            <Text style={s.title}>Bug report</Text>
            <View style={s.headerBtn} />
          </View>

          <MarkupCanvas ref={canvas} shot={shot} strokes={strokes} setStrokes={setStrokes} pen={pen} />

          <View style={s.tools}>
            {PENS.map((c) => (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Pen color ${c}`}
                accessibilityState={{ selected: pen === c }} onPress={() => setPen(c)} style={[s.swatchHit, pen === c && s.swatchOn]}>
                <View style={[s.swatch, { backgroundColor: c }]} />
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" disabled={!strokes.length} onPress={() => setStrokes((x) => x.slice(0, -1))}
              style={[s.toolBtn, !strokes.length && { opacity: 0.4 }]}>
              <Text style={s.headerText}>Undo</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!strokes.length} onPress={() => setStrokes([])}
              style={[s.toolBtn, !strokes.length && { opacity: 0.4 }]}>
              <Text style={s.headerText}>Clear</Text>
            </Pressable>
          </View>

          <View style={s.bottom}>
            <TextInput style={s.input} value={note} onChangeText={setNote} multiline maxLength={4000}
              placeholder="What's wrong? What did you expect?" placeholderTextColor={colors.muted} />
            <Button title="Send" busy={sending} disabled={!note.trim() && !strokes.length} onPress={send} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// The screenshot scaled to fit, with an SVG pen layer on top. The wrapper View is what
// gets captured on send, so the upload is the screenshot with the drawing baked in.
const MarkupCanvas = forwardRef<ComponentRef<typeof View>, {
  shot: Shot; strokes: Stroke[]; setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>; pen: string;
}>(function MarkupCanvas({ shot, strokes, setStrokes, pen }, ref) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const { width: screenW } = useWindowDimensions();
  const penRef = useRef(pen);
  penRef.current = pen;

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      setStrokes((all) => [...all, { color: penRef.current, points: [{ x, y }] }]);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      setStrokes((all) => {
        if (!all.length) return all;
        const last = all[all.length - 1];
        return [...all.slice(0, -1), { ...last, points: [...last.points, { x, y }] }];
      });
    },
  })).current;

  // Fit the screenshot inside the space between the header and the tools.
  let fit = { w: 0, h: 0 };
  if (box) {
    const scale = Math.min(box.w / shot.width, box.h / shot.height);
    fit = { w: shot.width * scale, h: shot.height * scale };
  }
  const width = Math.max(2, screenW / 130); // a marker-weight line

  return (
    <View style={s.canvasArea} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box ? (
        <View ref={ref} collapsable={false} style={[s.canvas, { width: fit.w, height: fit.h }]} {...responder.panHandlers}>
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
          <Svg style={StyleSheet.absoluteFill} width={fit.w} height={fit.h} pointerEvents="none">
            {strokes.map((st, i) => (
              <Path key={i} d={pathFor(st.points)} stroke={st.color} strokeWidth={width} fill="none"
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        </View>
      ) : null}
    </View>
  );
});

function pathFor(pts: { x: number; y: number }[]): string {
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y} l0.1 0`; // a tap draws a dot
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, height: 48 },
  headerBtn: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  headerText: { ...fonts.condensed, fontSize: 17, color: colors.ink },
  title: { ...font.h2, flex: 1, textAlign: 'center', color: colors.ink },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  canvas: { borderWidth: stroke, borderColor: colors.ink, overflow: 'hidden' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.lg, paddingVertical: space.sm },
  swatchHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: stroke, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.ink },
  swatch: { width: 26, height: 26, borderWidth: stroke, borderColor: colors.ink },
  toolBtn: { minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  input: {
    borderWidth: stroke, borderColor: colors.ink, padding: space.md, fontSize: 16, minHeight: 64, maxHeight: 120,
    color: colors.ink, textAlignVertical: 'top', ...fonts.input,
  },
});
