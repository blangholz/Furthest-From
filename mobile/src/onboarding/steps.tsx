// Onboarding, as a plain ordered list of steps. Benjamin will wireframe and
// iterate on this flow, so each step is self-contained: reorder, add or drop
// steps by editing ONBOARDING_STEPS. A step calls next() when it's done.
//
// Every step renders through StepScreen, which pins the primary button to the
// same spot at the bottom of the screen on every step (with a reserved slot
// under it for an optional small "skip" link, so the primary never moves).
import * as Location from 'expo-location';
import * as Notifications_ from 'expo-notifications';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Linking, Pressable, ScrollView, Share, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import MapView, { Circle, Marker, type MapPressEvent } from 'react-native-maps';
import { api, errorText } from '@/lib/api';
import { config, features } from '@/lib/config';
import type { LatLon } from '@/lib/geo';
import { currentFix } from '@/lib/location';
import { notificationPermission, registerForPush } from '@/lib/notifications';
import { RULES } from '@/lib/rules';
import { Body, Button, Card, Small, Title } from '@/ui/kit';
import { colors, font, fonts, radius, space } from '@/ui/theme';
import { PermissionPrimer, primerSupported, type PrimerKind } from './PermissionPrimer';

export type StepProps = { next: () => void };
export type Step = { key: string; Component: (p: StepProps) => React.ReactElement };

type Primary = { title: string; onPress: () => void; busy?: boolean; disabled?: boolean };

function StepScreen({ children, primary, skip, scroll = true }: {
  children: ReactNode; primary: Primary; skip?: { title: string; onPress: () => void }; scroll?: boolean;
}) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive" scrollEnabled={scroll}>
        {children}
      </ScrollView>
      <View style={s.footer}>
        <Button {...primary} />
        <View style={s.skipSlot}>
          {skip ? (
            <Pressable onPress={skip.onPress} hitSlop={12} accessibilityRole="button">
              <Text style={s.skip}>{skip.title}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Runs the iOS look-alike first (see PermissionPrimer), then the real prompt. */
function usePrimer(kind: PrimerKind, request: () => Promise<boolean>, after: (granted: boolean) => void) {
  const [visible, setVisible] = useState(false);
  const start = async () => {
    if (primerSupported) setVisible(true);
    else after(await request().catch(() => false));
  };
  const element = (
    <PermissionPrimer kind={kind} visible={visible} request={() => request().catch(() => false)}
      onDone={(g) => { setVisible(false); after(g); }} />
  );
  return { start, element };
}

function Welcome({ next }: StepProps) {
  return (
    <StepScreen primary={{ title: "Let's go", onPress: next }}>
      <Text style={{ fontSize: 64 }}>🍟</Text>
      <Title>How far from fries are you?</Title>
      <Body>Every day at 1:20 PM it's check-in time. Open the app within an hour and you score a point for every mile, as the crow flies, between you and the nearest McDonald's.</Body>
      <Body>Near home doesn't count. Getting out does.</Body>
      <Body muted>Other players only ever see your distance, never where you are.</Body>
    </StepScreen>
  );
}

// Name only. Usernames come back when friends ship (Decision #26): friends find
// each other by username, and nothing else uses it yet.
function Name({ next }: StepProps) {
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!displayName.trim() || busy) return;
    setBusy(true);
    try {
      await api.updateProfile({ displayName: displayName.trim() });
      next();
    } catch (e) {
      Alert.alert('Hmm', errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <StepScreen primary={{ title: 'Next', busy, disabled: !displayName.trim(), onPress: save }}>
      <Title>What should we call you?</Title>
      <TextInput style={s.input} placeholder="Your name" value={displayName} onChangeText={setDisplayName} maxLength={40}
        autoFocus autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={save} />
      <Small>Shown on the leaderboard.</Small>
    </StepScreen>
  );
}

async function requestLocation(): Promise<boolean> {
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

function LocationStep({ next }: StepProps) {
  // 'blocked': denied and iOS won't ask again, so only Settings can fix it.
  const [state, setStateRaw] = useState<'checking' | 'ask' | 'blocked' | 'granted'>('checking');
  const stateRef = useRef(state);
  const setState = (v: typeof state) => { stateRef.current = v; setStateRaw(v); };
  const moved = useRef(false);
  const go = () => {
    if (moved.current) return;
    moved.current = true;
    next();
  };

  const check = async () => {
    const cur = await Location.getForegroundPermissionsAsync();
    const was = stateRef.current;
    const now = cur.granted ? 'granted' : cur.canAskAgain ? 'ask' : 'blocked';
    setState(now);
    // Back from Settings with location turned on: carry on by itself.
    if (was === 'blocked' && now === 'granted') go();
  };

  // Only while this step is on screen: earlier steps stay mounted under later ones.
  useFocusEffect(useCallback(() => {
    moved.current = false;
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const primer = usePrimer('location', requestLocation, (granted) => {
    if (granted) { setState('granted'); go(); } else check();
  });

  const primary: Primary = state === 'blocked' ? { title: 'Open Settings', onPress: () => Linking.openSettings() }
    : state === 'granted' ? { title: 'Continue', onPress: go }
    : { title: 'Continue', disabled: state === 'checking', onPress: primer.start };

  return (
    <StepScreen primary={primary}>
      <Title>Location is how you play</Title>
      <Body>Your score is the distance from where you are to the nearest McDonald's, so McFarthest needs your location to work. It isn't optional: without it there's no game.</Body>
      <Body>It's only read while the app is open: to show your live distance, check in, or claim a spot. No background tracking.</Body>
      <Body>Your exact spot is used to work out the distance and then thrown away. It's never saved or shown to anyone.</Body>
      {state === 'blocked' ? (
        <Card tone="gold">
          <Body>Location is off for McFarthest. In Settings, tap Location and choose "While Using the App", then come back.</Body>
        </Card>
      ) : null}
      {primer.element}
    </StepScreen>
  );
}

const FALLBACK: LatLon = { lat: 39.5296, lon: -119.8138 }; // Reno, until we know better

function formatAddress(a: Location.LocationGeocodedAddress | undefined): string | null {
  if (!a) return null;
  const street = [a.streetNumber, a.street].filter(Boolean).join(' ') || a.name;
  return [street, a.city, a.region].filter(Boolean).join(', ') || null;
}

function HomePin({ next }: StepProps) {
  const map = useRef<MapView>(null);
  const [pin, setPin] = useState<LatLon | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const moveTo = (p: LatLon, zoom = false) => {
    setPin(p);
    if (zoom) map.current?.animateToRegion({ latitude: p.lat, longitude: p.lon, latitudeDelta: 0.2, longitudeDelta: 0.2 }, 400);
  };

  useEffect(() => {
    currentFix().then((f) => moveTo({ lat: f.lat, lon: f.lon })).catch(() => moveTo(FALLBACK));
  }, []);

  // Name the pinned spot so they can confirm it's really home.
  useEffect(() => {
    if (!pin) return;
    let live = true;
    setLabel(null);
    Location.reverseGeocodeAsync({ latitude: pin.lat, longitude: pin.lon })
      .then((r) => { if (live) setLabel(formatAddress(r[0])); })
      .catch(() => {});
    return () => { live = false; };
  }, [pin]);

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const [hit] = await Location.geocodeAsync(q);
      if (!hit) Alert.alert("Couldn't find that", 'Try adding the city or ZIP code.');
      else moveTo({ lat: hit.latitude, lon: hit.longitude }, true);
    } catch {
      Alert.alert("Couldn't find that", 'Try adding the city or ZIP code.');
    } finally {
      setSearching(false);
    }
  };

  const useHere = () => currentFix().then((f) => moveTo({ lat: f.lat, lon: f.lon }, true)).catch(() => {
    Alert.alert('No location yet', "We couldn't get a fix. Search for your address instead.");
  });

  const save = async () => {
    if (!pin) return;
    setBusy(true);
    try {
      await api.setHome(pin.lat, pin.lon);
      next();
    } catch (e) {
      Alert.alert('Hmm', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepScreen primary={{ title: 'Set home here', busy, disabled: !pin, onPress: save }}>
      <Title>Where's home?</Title>
      <Body>Check-ins within {RULES.homeRadiusMi} miles of home score zero. Only you can see it, and it stays put for the season.</Body>
      <View style={s.searchRow}>
        <TextInput style={[s.input, { flex: 1 }]} placeholder="Search your home address" value={query} onChangeText={setQuery}
          autoComplete="street-address" textContentType="fullStreetAddress" returnKeyType="search" onSubmitEditing={search} />
        <Pressable style={s.searchBtn} onPress={search} disabled={!query.trim() || searching} accessibilityRole="button" accessibilityLabel="Search">
          {searching ? <ActivityIndicator color="#fff" /> : <Text style={s.searchBtnText}>Find</Text>}
        </Pressable>
      </View>
      <View style={s.map}>
        {pin ? (
          <MapView ref={map} style={{ flex: 1 }} initialRegion={{ latitude: pin.lat, longitude: pin.lon, latitudeDelta: 0.25, longitudeDelta: 0.25 }}
            onPress={(e: MapPressEvent) => moveTo({ lat: e.nativeEvent.coordinate.latitude, lon: e.nativeEvent.coordinate.longitude })}>
            <Marker coordinate={{ latitude: pin.lat, longitude: pin.lon }} draggable
              onDragEnd={(e) => moveTo({ lat: e.nativeEvent.coordinate.latitude, lon: e.nativeEvent.coordinate.longitude })} />
            <Circle center={{ latitude: pin.lat, longitude: pin.lon }} radius={RULES.homeRadiusMi * 1609.344}
              strokeColor={colors.teal} fillColor="rgba(15,82,87,0.12)" />
          </MapView>
        ) : null}
      </View>
      <Small>{label ? `Pin: ${label}` : 'Tap the map or drag the pin to fine-tune.'}</Small>
      <Pressable onPress={useHere} hitSlop={8} accessibilityRole="button">
        <Text style={s.link}>I'm home now: use my current location</Text>
      </Pressable>
    </StepScreen>
  );
}

async function requestNotifications(): Promise<boolean> {
  return notificationPermission(true);
}

function Notifications({ next }: StepProps) {
  const finish = async (granted: boolean) => {
    if (granted) await registerForPush().catch(() => {});
    next();
  };
  const primer = usePrimer('notifications', requestNotifications, finish);
  // Already allowed (or already denied, so iOS won't show its alert): skip the preview.
  const start = async () => {
    const cur = await Notifications_.getPermissionsAsync();
    if (cur.granted || !cur.canAskAgain) finish(cur.granted);
    else primer.start();
  };
  return (
    <StepScreen primary={{ title: 'Continue', onPress: start }} skip={{ title: 'Not now', onPress: next }}>
      <Title>We need to buzz you</Title>
      <Body>The game runs on one check-in a day. At 1:20 PM, wherever you are, your phone buzzes and you have an hour to check in.</Body>
      <Body>To play, McFarthest has to be able to send you that alert. Miss it and you score nothing that day.{features.friends ? " You'll also hear when a friend checks in a big one." : ''}</Body>
      {primer.element}
    </StepScreen>
  );
}

function Friends({ next }: StepProps) {
  const [username, setUsername] = useState('');
  const invite = async () => {
    try {
      const code = await api.createInvite();
      await Share.share({ message: `Play McFarthest with me: ${config.webUrl}/i/${code}` });
    } catch (e) {
      Alert.alert('Hmm', errorText(e));
    }
  };
  return (
    <StepScreen primary={{ title: 'Start playing', onPress: next }}>
      <Title>Bring your friends</Title>
      <Body>McFarthest is better with friends. Send an invite link or add someone by username.</Body>
      <Button title="Share an invite link" kind="secondary" onPress={invite} />
      <Card>
        <TextInput style={s.input} placeholder="Friend's username" autoCapitalize="none" value={username} onChangeText={setUsername} />
        <Button title="Send request" kind="quiet" disabled={username.length < 3} onPress={async () => {
          try {
            await api.requestFriend(username);
            Alert.alert('Sent', `Friend request sent to ${username}.`);
            setUsername('');
          } catch (e) {
            Alert.alert('Hmm', errorText(e));
          }
        }} />
      </Card>
    </StepScreen>
  );
}

export const ONBOARDING_STEPS: Step[] = [
  { key: 'welcome', Component: Welcome },
  { key: 'name', Component: Name },
  { key: 'location', Component: LocationStep },
  { key: 'home', Component: HomePin },
  { key: 'notifications', Component: Notifications },
  ...(features.friends ? [{ key: 'friends', Component: Friends }] : []),
];

const s = StyleSheet.create({
  body: { padding: space.lg, paddingTop: space.sm, gap: space.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm },
  // Always reserved, so the primary button sits in the same place with or without a skip link.
  skipSlot: { height: 44, alignItems: 'center', justifyContent: 'center' },
  skip: { ...font.small, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.ink, borderRadius: radius.sm, padding: space.md, fontSize: 17, ...fonts.input },
  searchRow: { flexDirection: 'row', gap: space.sm },
  searchBtn: { backgroundColor: colors.teal, paddingHorizontal: space.lg, justifyContent: 'center', minWidth: 64, alignItems: 'center' },
  searchBtnText: { ...fonts.condensed, color: '#fff', fontSize: 21, letterSpacing: 1 },
  map: { height: 300, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.line },
  link: { ...font.body, color: colors.teal, paddingVertical: space.xs },
});
