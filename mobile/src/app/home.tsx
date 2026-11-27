// Home, the app's only screen (Decision #40): burger + wordmark + person icon (Me), "You are
// currently" with the big live distance, the edge compass (a dot + N in the margin pointing
// at McDonald's within 5 mi and north, plus an arrow pointing the way to get farther away; the full-size radar is parked in ui/FullSizeRadar), the next check-in countdown, today's check-in
// rows (the result becomes a register entry), and the leaderboard below. The map of nearby
// McDonald's (ui/MiniMap) sits right under the distance box.
// The live number is computed on the phone from the bundled store list; watching it
// never sends anything. Only "Check in" sends one point, once.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { errorText, type LogResult } from '@/lib/api';
import { demoMode, features } from '@/lib/config';
import { bearingDeg, escapeBearing, formatMiles, haversineMi } from '@/lib/geo';
import { nextCheckInOpensAt } from '@/lib/rules';
import { currentFix, useHeading, useLiveLocation } from '@/lib/location';
import { shareInvite } from '@/lib/invites';
import { submitOrQueue } from '@/lib/offline-queue';
import { useStatus, refreshStatus } from '@/lib/status';
import { storeIndex } from '@/lib/stores';
import { countdown, resultHeadline } from '@/ui/format';
import { brand, BurgerMark, Button, Card, IconButton, Label, Row, Rows, Screen, Small, Title } from '@/ui/kit';
import { Leaderboard } from '@/ui/Leaderboard';
import { MiniMap } from '@/ui/MiniMap';
import { EdgeCompass, RADIUS_MI, type EdgeStore } from '@/ui/EdgeCompass';

// Screen-edge compass (dots + N + escape arrow). Off for now; flip to true to bring it back.
const SHOW_EDGE_COMPASS = false;
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
  const [topH, setTopH] = useState(0);
  useTick(1000);

  const nearest = useMemo(() => (pos ? storeIndex().nearest(pos) : null), [pos]);
  // Margin dots: every McDonald's within RADIUS_MI (capped at 60 for dense downtowns), plus the nearest even if it's farther. Farthest first so the nearest draws on top.
  const edgeStores = useMemo<EdgeStore[]>(() => {
    if (!SHOW_EDGE_COMPASS || !pos) return [];
    const pts = storeIndex().within(pos, RADIUS_MI, 60);
    if (nearest && !pts.length) pts.push(nearest.store);
    return pts
      .map((p) => ({ key: `${p.lat},${p.lon}`, bearing: bearingDeg(pos, p), mi: haversineMi(pos, p) }))
      .sort((a, b) => b.mi - a.mi);
  }, [pos, nearest]);
  // Arrow: the way to walk to get farther from the surrounding McDonald's.
  const escape = useMemo(() => (SHOW_EDGE_COMPASS && pos ? escapeBearing(storeIndex(), pos) : null), [pos]);

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

  return (
    <View style={s.root}>
    <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.ink} onRefresh={async () => {
      setRefreshing(true);
      setBoardKey((k) => k + 1);
      await refreshStatus();
      setRefreshing(false);
    }} />}>
      <View style={s.header}>
        <View style={s.brandRow}>
          <BurgerMark />
          <Text style={s.wordmark} adjustsFontSizeToFit numberOfLines={1}>{brand('McFarthest')}</Text>
        </View>
        <IconButton icon="person" android="person" label="Me" onPress={() => router.push('/me')} />
      </View>

      <View onLayout={(e) => setTopH(e.nativeEvent.layout.height)}>
      <Card label="You are currently">
        <Text style={s.big} adjustsFontSizeToFit numberOfLines={1}>{formatMiles(nearest?.mi)}</Text>
        {error ? <Small>{error}</Small> : !pos ? <Small>Finding you…</Small> : null}
        <Label>Miles from the nearest McDonald's</Label>
      </Card>
      </View>

      {/* Same height as the distance box above it. */}
      <MiniMap pos={pos} nearest={nearest} heading={heading} height={topH || undefined} />

      {!result && open ? (
        <Card>
          <Text style={s.nextTitle}>Check-in open · closes in</Text>
          <Text style={s.nextClock}>{countdown(open.closesAt)}</Text>
          <Small>Your exact spot is used for the score and then thrown away.</Small>
          <Button title="Check in" busy={busy === 'ping'} onPress={() => log('ping')} />
        </Card>
      ) : null}
      {/* Between check-ins: a disabled button that counts down to the next one (bug report #3). */}
      {!result && !open ? (
        <>
          <Button title={`Next check-in ${nextOpens ? countdown(nextOpens) : '…'}`} disabled onPress={() => {}} />
          {demoMode ? <Small>Demo mode: open a practice check-in from Me.</Small> : null}
        </>
      ) : null}

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
      ) : fries > 0 && !open ? (
        <Button title={`Use Extra Fries (${fries})`} kind="secondary" busy={busy === 'fries'} onPress={useFries} />
      ) : null}

      <Leaderboard refreshKey={boardKey} />
      <Button title="Invite your friends" kind="secondary" onPress={shareInvite} />
    </Screen>
    {SHOW_EDGE_COMPASS ? <EdgeCompass stores={edgeStores} escape={escape} heading={heading} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: -10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  // DIN Condensed keeps a tall descender area, so its caps sit high in the line box;
  // nudge the wordmark down so the caps center on the burger and the person icon.
  wordmark: { ...font.title, fontSize: 30, lineHeight: 34, marginTop: 6, color: colors.ink },
  big: { ...font.huge, color: colors.ink, lineHeight: 104, marginBottom: -6 },
  nextTitle: { ...font.h2, color: colors.ink },
  // Countdown in clock digits (think the TV show 24): fixed-width so it doesn't jitter.
  nextClock: { ...font.value, fontSize: 22, color: colors.ink },
});
