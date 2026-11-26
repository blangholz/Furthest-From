// Home: the big live distance number, a radar to the nearest McDonald's, today's check-in, Extra Fries,
// and the leaderboard below (scroll down).
// The live number is computed on the phone from the bundled store list; watching it
// never sends anything. Only "Check in" sends one point, once.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { errorText, type LogResult } from '@/lib/api';
import { demoMode } from '@/lib/config';
import { formatMiles } from '@/lib/geo';
import { nextCheckInOpensAt } from '@/lib/rules';
import { currentFix, useHeading, useLiveLocation } from '@/lib/location';
import { submitOrQueue } from '@/lib/offline-queue';
import { useStatus, refreshStatus } from '@/lib/status';
import { storeIndex } from '@/lib/stores';
import { countdown, resultHeadline } from '@/ui/format';
import { Body, brand, Button, Card, H2, Pill, Screen, Small } from '@/ui/kit';
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
  const radarSize = Math.min(width - space.lg * 4, 420);

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
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
      setRefreshing(true);
      setBoardKey((k) => k + 1);
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
        <Text style={s.unit}>{brand("miles from the nearest McDonald's")}</Text>
        {error ? <Small center>{error}</Small> : !pos ? <Small center>Finding you…</Small> : null}
      </View>

      <View style={s.radar}>
        <Radar size={radarSize} you={pos} store={nearest?.store ?? null} heading={heading} />
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
          <Text style={s.clockLabel}>You have</Text>
          <Text style={s.clock} adjustsFontSizeToFit numberOfLines={1}>{countdown(open.closesAt)}</Text>
          <Text style={s.clockLabel}>to check in</Text>
          <Small center>Your exact spot is used for the score and then thrown away.</Small>
          <Button title="Check in" busy={busy === 'ping'} onPress={() => log('ping')} />
        </Card>
      ) : (
        <Card>
          <Text style={s.clockLabel}>{nextOpens ? 'Next check-in in' : 'Check-in opening…'}</Text>
          {nextOpens ? <Text style={s.clockSmall} adjustsFontSizeToFit numberOfLines={1}>{countdown(nextOpens)}</Text> : null}
          {demoMode ? <Small center>Demo mode: open a practice check-in from the Me tab.</Small> : null}
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

      <Leaderboard refreshKey={boardKey} />
    </Screen>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { alignItems: 'center', paddingVertical: space.xl },
  big: { ...font.huge, color: colors.ink },
  unit: { ...font.body, fontSize: 16, color: colors.muted, marginTop: -4 },
  radar: { alignItems: 'center', paddingTop: 48, paddingBottom: space.xl },
  // Countdown in big clock digits (think the TV show 24): fixed-width so it doesn't jitter.
  clock: { ...font.huge, fontSize: 96, color: colors.ink, textAlign: 'center', lineHeight: 100 },
  clockSmall: { ...font.huge, fontSize: 56, letterSpacing: -1, color: colors.ink, textAlign: 'center', lineHeight: 62 },
  clockLabel: { ...font.h2, fontSize: 18, color: colors.ink, textAlign: 'center' },
});
