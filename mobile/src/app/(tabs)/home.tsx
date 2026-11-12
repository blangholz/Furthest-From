// Home: the big live distance number, today's ping, Extra Fries, and your personal map.
// The live number is computed on the phone from the bundled store list; watching it
// never sends or logs anything. Only "Log my distance" sends one point, once.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { api, errorText, type LogResult } from '@/lib/api';
import { demoMode } from '@/lib/config';
import { formatMiles } from '@/lib/geo';
import { currentFix, useLiveLocation } from '@/lib/location';
import { submitOrQueue } from '@/lib/offline-queue';
import { RULES } from '@/lib/rules';
import { useStatus, refreshStatus } from '@/lib/status';
import { storeIndex } from '@/lib/stores';
import { countdown, resultHeadline } from '@/ui/format';
import { Body, Button, Card, H2, Pill, Screen, Small } from '@/ui/kit';
import { colors, font, radius, space } from '@/ui/theme';

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export default function Home() {
  const { status } = useStatus();
  const { pos, error } = useLiveLocation(true);
  const [busy, setBusy] = useState<'ping' | 'fries' | null>(null);
  const [result, setResult] = useState<LogResult | null>(null);
  const [home, setHome] = useState<{ lat: number; lon: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  useTick(1000);

  useEffect(() => {
    api.myHome().then(setHome).catch(() => {});
  }, []);

  const nearest = useMemo(() => (pos ? storeIndex().nearest(pos) : null), [pos]);
  const nearby = useMemo(() => (pos ? storeIndex().within(pos, RULES.mapRadiusMi) : []), [pos]);

  const log = useCallback(async (kind: 'ping' | 'extra_fries') => {
    setBusy(kind === 'ping' ? 'ping' : 'fries');
    try {
      const fix = await currentFix();
      const r = await submitOrQueue({ lat: fix.lat, lon: fix.lon, kind });
      setResult(r);
      await refreshStatus();
    } catch (e) {
      Alert.alert(kind === 'ping' ? 'Not logged' : 'Extra Fries not used', errorText(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const useFries = () =>
    Alert.alert('Use Extra Fries?', 'This logs your distance right now and spends one Extra Fries.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use it', onPress: () => log('extra_fries') },
    ]);

  const open = status?.openPing && new Date(status.openPing.closesAt).getTime() > Date.now() ? status.openPing : null;
  const fries = status?.extraFries.length ?? 0;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
      setRefreshing(true);
      await refreshStatus();
      setRefreshing(false);
    }} />}>
      <View style={s.topRow}>
        <Pill text={status?.season.name ?? ''} tone="muted" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Pill text={`🔥 ${status?.streak ?? 0}`} />
          <Pill text={`🍟 ${fries}`} tone="teal" />
        </View>
      </View>

      <View style={s.hero}>
        <Text style={s.big} adjustsFontSizeToFit numberOfLines={1}>{formatMiles(nearest?.mi)}</Text>
        <Text style={s.unit}>miles from the nearest McDonald's</Text>
        {error ? <Small center>{error}</Small> : !pos ? <Small center>Finding you…</Small> : null}
      </View>

      {result ? (
        <Card tone="gold">
          <H2>{resultHeadline(result)}</H2>
          <Body>
            {formatMiles(result.distanceMi)} miles from the nearest McDonald's
            {result.zone === 'home' ? '. Home check-ins score zero and pause your streak.' : '.'}
          </Body>
          <Small>
            Streak {result.streak}
            {result.extraFriesEarned ? ` · You earned ${result.extraFriesEarned} Extra Fries!` : ''}
          </Small>
          <Button title="Nice" kind="quiet" onPress={() => setResult(null)} />
        </Card>
      ) : open ? (
        <Card tone="teal">
          <H2>Ping! {countdown(open.closesAt)} left</H2>
          <Body>Log your distance now. Your exact spot is used for the score and then thrown away.</Body>
          <Button title="Log my distance" busy={busy === 'ping'} onPress={() => log('ping')} />
        </Card>
      ) : (
        <Card>
          <Body>
            {status?.todayLogged ? "Today's ping is logged. " : ''}The daily ping is at 1:20 PM your time. You get an hour to log.
          </Body>
          {demoMode ? <Small>Demo mode: open a practice ping from the Me tab.</Small> : null}
        </Card>
      )}

      {fries > 0 && !open ? (
        <Card>
          <Body>
            You have {fries} Extra Fries. Use one when you know you're far out. The next expires{' '}
            {new Date(status!.extraFries[0].expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
          </Body>
          <Button title="Use Extra Fries" kind="secondary" busy={busy === 'fries'} onPress={useFries} />
        </Card>
      ) : null}

      <View style={s.map}>
        {pos ? (
          <MapView
            style={{ flex: 1 }}
            showsUserLocation
            showsPointsOfInterests={false}
            initialRegion={{ latitude: pos.lat, longitude: pos.lon, latitudeDelta: 0.6, longitudeDelta: 0.6 }}>
            {nearby.map((p, i) => (
              <Marker key={i} coordinate={{ latitude: p.lat, longitude: p.lon }} pinColor={colors.gold} tracksViewChanges={false} />
            ))}
            {home ? (
              <Circle center={{ latitude: home.lat, longitude: home.lon }} radius={RULES.homeRadiusMi * 1609.344}
                strokeColor={colors.teal} fillColor="rgba(15,82,87,0.10)" />
            ) : null}
          </MapView>
        ) : null}
      </View>
      <Small center>Only you see this map: you, your home zone, and McDonald's within {RULES.mapRadiusMi} miles.</Small>
    </Screen>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { alignItems: 'center', paddingVertical: space.xl },
  big: { ...font.huge, color: colors.ink },
  unit: { fontSize: 17, color: colors.muted, marginTop: -4 },
  map: { height: 280, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.line },
});
