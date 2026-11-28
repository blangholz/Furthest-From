// A look-alike of the iOS permission alert, shown just before the real one.
// It sits where iOS will draw the real alert and points at the button to tap,
// so when the player taps, the real alert appears in the same spot and their
// thumb is already on the right button.
//
// iOS only: Android's permission dialogs look different, so there we go
// straight to the real prompt. The caption above the card keeps it clear this
// is a preview (App Review rejects primers that pass themselves off as the
// system alert).
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/ui/theme';

export type PrimerKind = 'location' | 'notifications';

const APP = 'McFarthest';
// Same text as NSLocationWhenInUseUsageDescription in app.json.
const LOCATION_REASON =
  "McFarthest uses your location to measure how far you are from the nearest McDonald's. Your exact location is never shown to anyone.";

export const primerSupported = Platform.OS === 'ios';

/**
 * Shows the preview. When the player taps anywhere, it calls `request` (which
 * opens the real system alert on top of the preview), waits for it, then hides.
 */
export function PermissionPrimer({ kind, visible, request, onDone }: {
  kind: PrimerKind;
  visible: boolean;
  request: () => Promise<boolean>;
  onDone: (granted: boolean) => void;
}) {
  const [asking, setAsking] = useState(false);
  const dim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setAsking(false);
    dim.setValue(0);
    Animated.timing(dim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, dim, pulse]);

  const tap = async () => {
    if (asking) return;
    setAsking(true);
    // iOS dims behind its own alert, so drop ours to avoid a double dim.
    Animated.timing(dim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    let granted = false;
    try {
      granted = await request();
    } finally {
      onDone(granted);
    }
  };

  const ring = { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => onDone(false)}>
      <Pressable style={StyleSheet.absoluteFill} onPress={tap} accessibilityRole="button"
        accessibilityLabel={kind === 'location' ? 'Continue to the location prompt' : 'Continue to the notifications prompt'}>
        <Animated.View style={[StyleSheet.absoluteFill, s.dim, { opacity: dim }]} />
        <View style={s.center} pointerEvents="none">
          {!asking ? (
            <Text style={s.caption}>
              iOS will ask next. Tap{' '}
              <Text style={{ color: '#F2A900' }}>{kind === 'location' ? 'Allow While Using App' : 'Allow'}</Text>
            </Text>
          ) : null}
          {kind === 'location' ? <LocationAlert ring={ring} /> : <NotificationAlert ring={ring} />}
          {!asking ? <Text style={s.hand}>👆</Text> : null}
        </View>
      </Pressable>
    </Modal>
  );
}

type RingStyle = { opacity: Animated.AnimatedInterpolation<number> };

function Highlight({ ring }: { ring: RingStyle }) {
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.ring, ring]} />;
}

function LocationAlert({ ring }: { ring: RingStyle }) {
  return (
    <View style={s.alert}>
      <View style={s.head}>
        <Text style={s.title}>Allow “{APP}” to use your location?</Text>
        <Text style={s.msg}>{LOCATION_REASON}</Text>
      </View>
      <View style={s.mapThumb}>
        <View style={s.mapDot} />
        <View style={s.precise}><Text style={s.preciseText}>➤ Precise: On</Text></View>
      </View>
      <View style={s.sep} />
      <Text style={s.btn}>Allow Once</Text>
      <View style={s.sep} />
      <View>
        <Text style={[s.btn, s.btnBold]}>Allow While Using App</Text>
        <Highlight ring={ring} />
      </View>
      <View style={s.sep} />
      <Text style={s.btn}>Don’t Allow</Text>
    </View>
  );
}

function NotificationAlert({ ring }: { ring: RingStyle }) {
  return (
    <View style={s.alert}>
      <View style={s.head}>
        <Text style={s.title}>“{APP}” Would Like to Send You Notifications</Text>
        <Text style={s.msg}>Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.</Text>
      </View>
      <View style={s.sep} />
      <View style={{ flexDirection: 'row' }}>
        <Text style={[s.btn, { flex: 1 }]}>Don’t Allow</Text>
        <View style={s.vsep} />
        <View style={{ flex: 1 }}>
          <Text style={[s.btn, s.btnBold]}>Allow</Text>
          <Highlight ring={ring} />
        </View>
      </View>
    </View>
  );
}

const BLUE = '#0A84FF';
const s = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.4)' },
  // iOS centres its alerts on the screen, so the preview does too.
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: {
    position: 'absolute', top: '16%', left: 24, right: 24, textAlign: 'center',
    color: '#fff', fontSize: 17, lineHeight: 23, ...fonts.alternate, letterSpacing: 0.5,
  },
  hand: { fontSize: 44, marginTop: 6 },
  alert: { width: 270, borderRadius: 14, backgroundColor: 'rgba(242,242,242,0.97)', overflow: 'hidden' },
  head: { paddingHorizontal: 16, paddingTop: 19, paddingBottom: 15, gap: 4 },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center', color: '#000', lineHeight: 22 },
  msg: { fontSize: 13, textAlign: 'center', color: '#000', lineHeight: 17 },
  mapThumb: { height: 128, marginHorizontal: 0, backgroundColor: '#DCE8D2', alignItems: 'center', justifyContent: 'center' },
  mapDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: BLUE, borderWidth: 3, borderColor: '#fff' },
  precise: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  preciseText: { fontSize: 12, color: BLUE, fontWeight: '600' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(60,60,67,0.36)' },
  vsep: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(60,60,67,0.36)' },
  btn: { fontSize: 17, color: BLUE, textAlign: 'center', paddingVertical: 11 },
  btnBold: { fontWeight: '600' },
  ring: { borderWidth: 3, borderColor: '#F2A900', borderRadius: 10, margin: 3 },
});
