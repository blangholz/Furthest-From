// Home, the app's only screen (Decision #29): wordmark + person icon (Me), the big live
// distance with the nearest McDonald's town and coordinates, a radar, your own coordinates
// (only you see them), today's check-in as a register entry, and the leaderboard below.
// The live number is computed on the phone from the bundled store list; watching it
// never sends anything. Only "Check in" sends one point, once.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Alert, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { errorText, type LogResult } from '@/lib/api';
import { demoMode } from '@/lib/config';
import { formatMiles } from '@/lib/geo';
import { nextCheckInOpensAt } from '@/lib/rules';
import { currentFix, useHeading, useLiveLocation } from '@/lib/location';
import { submitOrQueue } from '@/lib/offline-queue';
import { useStatus, refreshStatus } from '@/lib/status';
import { storeIndex } from '@/lib/stores';
import { countdown, formatLatLon, resultHeadline } from '@/ui/format';
import { brand, Button, Card, IconButton, Label, Row, Rows, Screen, Small, Title } from '@/ui/kit';
import { Leaderboard } from '@/ui/Leaderboard';
import { Radar } from '@/ui/Radar';
import { colors, font, space } from '@/ui/theme';

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
  const heading = useHeading(pos != null);
  const [busy, setBusy] = useState<'ping' | 'fries' | null>(null);
  const [result, setResult] = useState<LogResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  useTick(1000);

  const nearest = useMemo(() => (pos ? storeIndex().nearest(pos) : null), [pos]);
  const { width } = useWindowDimensions();
  const radarSize = Math.min(width - space.lg * 6, 380);

  const log = useCallback(async (kind: 'ping' | 'extra_fries') => {
    setBusy(kind === 'ping' ? 'ping' : 'fries');
    try {
      const fix = await currentFix();
      const r = await submitOrQueue({ lat: fix.lat, lon: fix.lon, kind });
      setResult(r);
      await refreshStatus();
    } catch (e) {
      Alert.alert(kind === 'ping' ? 'Check-in failed' : 'Extra Fries not used', errorText(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const useFries = () =>
    Alert.alert('Use Extra Fries?', 'This checks you in right now and spends one Extra Fries.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use it', onPress: () => log('extra_fries') },
    ]);

  const open = status?.openPing && new Date(status.openPing.closesAt).getTime() > Date.now() ? status.openPing : null;
  const fries = status?.extraFries.length ?? 0;
  const nextOpens = nextCheckInOpensAt(new Date(), status?.todayLogged ?? false);

  // The window just opened by the clock but status hasn't caught up: re-check every 15 s.
  const lastPoll = useRef(0);
  useEffect(() => {
    if (open || nextOpens || Date.now() - lastPoll.current < 15_000) return;
    lastPoll.current = Date.now();
    refreshStatus();
  });

  const nearestLine = nearest
    ? [nearest.store.place, formatLatLon(nearest.store)].filter(Boolean).join(' · ')
    : null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.ink} onRefresh={async () => {
      setRefreshing(true);
      setBoardKey((k) => k + 1);
      await refreshStatus();
      setRefreshing(false);
    }} />}>
      <View style={s.header}>
        <Text style={s.wordmark} adjustsFontSizeToFit numberOfLines={1}>{brand('McFarthest')}</Text>
        <IconButton icon="person" android="person" label="Me" onPress={() => router.push('/me')} />
      </View>

      <Card label="Miles from the nearest McDonald's">
        <Text style={s.big} adjustsFontSizeToFit numberOfLines={1}>{formatMiles(nearest?.mi)}</Text>
        {error ? <Small>{error}</Small> : !pos ? <Small>Finding you…</Small> : null}
        {nearestLine ? <Label>Nearest: {nearestLine}</Label> : null}
      </Card>

      <Card style={s.radarBox}>
        <Radar size={radarSize} you={pos} store={nearest?.store ?? null} heading={heading} />
      </Card>

      <Card label="You are here · only you see this">
        <Text style={s.coords}>{pos ? formatLatLon(pos) : '—'}</Text>
      </Card>

      {result ? (
        <Card label={`Signed · ${new Date().toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: '2-digit' })}`}>
          <Title>{resultHeadline(result)}</Title>
          <Rows>
            <Row left="Time" right={new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} />
            <Row left="Place" right={result.regionName ?? '—'} />
            <Row left="Distance" right={`${formatMiles(result.distanceMi)} mi`} />
            <Row left="Points" right={result.zone === 'scoring' ? `+${formatMiles(result.points)}` : '0'} />
            <Row left="Streak" right={String(result.streak)} />
            {result.extraFriesEarned ? <Row left="Extra Fries earned" right={`+${result.extraFriesEarned}`} /> : null}
          </Rows>
          {result.zone === 'home' ? <Small>Home check-ins score zero and pause your streak.</Small> : null}
          <Button title="Done" onPress={() => setResult(null)} />
        </Card>
      ) : (
        <Card label="Today's check-in">
          {open ? (
            <>
              <Text style={s.clock} adjustsFontSizeToFit numberOfLines={1}>{countdown(open.closesAt)}</Text>
              <Label>Left to check in</Label>
            </>
          ) : null}
          <Rows>
            <Row left="Status" right={open ? 'Open' : status?.todayLogged ? 'Done for today' : nextOpens ? 'Closed' : 'Opening…'} />
            {!open && nextOpens ? <Row left="Next check-in in" right={countdown(nextOpens)} /> : null}
            <Row left="Streak" right={String(status?.streak ?? 0)} />
            <Row left="Extra Fries" right={fries > 0
              ? `${fries} · exp. ${new Date(status!.extraFries[0].expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : '0'} />
          </Rows>
          {open ? (
            <>
              <Small>Your exact spot is used for the score and then thrown away.</Small>
              <Button title="Check in" busy={busy === 'ping'} onPress={() => log('ping')} />
            </>
          ) : fries > 0 ? (
            <>
              <Small>Use Extra Fries when you know you're far out. It checks you in right now.</Small>
              <Button title="Use Extra Fries" kind="secondary" busy={busy === 'fries'} onPress={useFries} />
            </>
          ) : null}
          {demoMode && !open ? <Small>Demo mode: open a practice check-in from Me.</Small> : null}
        </Card>
      )}

      <Leaderboard refreshKey={boardKey} />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: -10 },
  wordmark: { ...font.title, fontSize: 30, color: colors.ink },
  big: { ...font.huge, color: colors.ink, lineHeight: 104, marginBottom: -6 },
  // Room above and below for the radar's N label and facing tick.
  radarBox: { alignItems: 'center', paddingTop: 52, paddingBottom: space.lg },
  coords: { ...font.h2, color: colors.ink, fontVariant: ['tabular-nums'] },
  // Countdown in big clock digits (think the TV show 24): fixed-width so it doesn't jitter.
  clock: { ...font.huge, fontSize: 88, lineHeight: 92, color: colors.ink, fontVariant: ['tabular-nums'] },
});
