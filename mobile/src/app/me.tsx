// Me: your stats, Ticks (Decision #28: the state tick grid, Top 100 and the full list),
// Extra Fries, logs, home pin and account. Opened from the person icon on Home.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { api, demoApi, errorText, type Spot } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config, demoMode, features } from '@/lib/config';
import { formatMiles, haversineMi } from '@/lib/geo';
import { useLiveLocation } from '@/lib/location';
import { scheduleLocalPing } from '@/lib/notifications';
import { pendingCount } from '@/lib/offline-queue';
import { RULES } from '@/lib/rules';
import { refreshStatus, useStatus } from '@/lib/status';
import { Body, Button, Card, H2, Loading, Row, Rows, Screen, Small, Title } from '@/ui/kit';
import { TickGrid } from '@/ui/TickGrid';
import { colors, font } from '@/ui/theme';

export default function Me() {
  const { status } = useStatus();
  const { signOut } = useAuth();
  const [pending, setPending] = useState(0);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const { pos } = useLiveLocation(true);

  useFocusEffect(useCallback(() => {
    refreshStatus();
    pendingCount().then(setPending);
    api.spots().then(setSpots).catch(() => setSpots([]));
  }, []));

  const states = useMemo(() => (spots ?? []).filter((s) => s.kind === 'state'), [spots]);
  const top100 = useMemo(() => (spots ?? []).filter((s) => s.kind === 'top100'), [spots]);
  const nearestOpen = useMemo(() => {
    if (!pos) return null;
    let best: { spot: Spot; mi: number } | null = null;
    for (const s of states) if (!s.claimed) {
      const mi = haversineMi(pos, s);
      if (!best || mi < best.mi) best = { spot: s, mi };
    }
    return best;
  }, [pos, states]);

  if (!status) return <Screen edges={[]}><Loading /></Screen>;

  const invite = async () => {
    try {
      if (!features.friends) {
        // No friendships yet, so just share the app.
        await Share.share({ message: `How far from fries can you get? Play McFarthest: ${config.webUrl}` });
        return;
      }
      const code = await api.createInvite();
      await Share.share({ message: `Play McFarthest with me: ${config.webUrl}/i/${code}` });
    } catch (e) {
      Alert.alert('Hmm', errorText(e));
    }
  };

  const del = () =>
    Alert.alert('Delete your account?', `This removes your profile, scores, ticks${features.friends ? ' and friends' : ''} for good.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteAccount();
          await signOut();
        } catch (e) {
          Alert.alert('Hmm', errorText(e));
        }
      } },
    ]);

  const ticked = states.filter((s) => s.claimed).length;
  return (
    <Screen edges={[]}>
      <Title>{status.displayName || 'Me'}</Title>
      {status.username ? <Body muted>@{status.username}</Body> : null}

      <Card>
        <Rows>
          <Row left="Season points" sub={status.season.name} right={formatMiles(status.seasonPoints)} />
          <Row left="All-time points" right={formatMiles(status.allTimePoints)} />
          <Row left="Streak" right={`${status.streak} · best ${status.bestStreak}`} />
        </Rows>
      </Card>

      <Card>
        <View style={s.tickHead}>
          <H2>Ticks</H2>
          <Text style={s.tickCount}>{spots ? `${ticked} / ${states.length}` : ''}</Text>
        </View>
        <Small>The furthest point from any McDonald's in each state, on public land you can visit. Stand within {RULES.claimRadiusFt} ft to tick it. Ticks are permanent.</Small>
        {!spots ? <Loading /> : <TickGrid spots={states} />}
        <Rows>
          {nearestOpen ? (
            <Row left={`Nearest: ${nearestOpen.spot.stateName}`} sub={`${formatMiles(nearestOpen.mi)} mi from you`} right="›"
              onPress={() => router.push({ pathname: '/spot/[id]', params: { id: String(nearestOpen.spot.id) } })} />
          ) : null}
          <Row left="Top 100" sub="The 100 furthest points in the lower 48" right={`${top100.filter((s) => s.claimed).length} / ${top100.length} ›`}
            onPress={() => router.push({ pathname: '/ticks', params: { tab: 'top100' } })} />
          <Row left="All ticks as a list" right="›" onPress={() => router.push('/ticks')} />
        </Rows>
      </Card>

      <Card label="Extra Fries">
        <Body>{status.friesCredits} of {status.friesPer} check-ins toward your next one{status.streak >= RULES.doubleCreditStreak ? ' (double speed on your streak)' : ''}.</Body>
        {status.extraFries.length === 0 ? <Small>You don't have any right now.</Small> : (
          <Rows>
            {status.extraFries.map((f) => (
              <Row key={f.id} left="Extra Fries" right={`exp. ${new Date(f.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} />
            ))}
          </Rows>
        )}
        <Small>Earn one every {RULES.friesPerCredits} check-ins away from home. At a {RULES.doubleCreditStreak}-day streak they come twice as fast. Each lasts 2 weeks.</Small>
      </Card>

      <Card>
        <Rows>
          {features.friends ? (
            <Row left="Friends" sub={`${status.friendCount} friend${status.friendCount === 1 ? '' : 's'}`} right="›" onPress={() => router.push('/friends')} />
          ) : null}
          {features.friends ? <Row left="Friends feed" right="›" onPress={() => router.push('/feed')} /> : null}
          <Row left="Passport" sub="Check-ins outside the lower 48" right="›" onPress={() => router.push({ pathname: '/logs/[zone]', params: { zone: 'passport' } })} />
          <Row left="Home check-ins" sub="Check-ins from your home zone" right="›" onPress={() => router.push({ pathname: '/logs/[zone]', params: { zone: 'home' } })} />
        </Rows>
        <Button title={features.friends ? 'Invite a friend' : 'Tell a friend'} kind="secondary" onPress={invite} />
      </Card>

      <Card label="Home pin">
        <Body>{status.hasHome ? `Your home pin is locked until ${status.homeLockedUntil ? new Date(status.homeLockedUntil).toLocaleDateString() : 'next season'}. You can move it when the next season starts.` : 'No home pin set.'}</Body>
        <Small>Only you can see your home pin. Check-ins within {RULES.homeRadiusMi} miles of it score zero.</Small>
      </Card>

      {pending > 0 ? <Card><Body>{pending} check-in{pending === 1 ? '' : 's'} waiting to upload. They'll go when you're back online.</Body></Card> : null}

      {demoMode ? (
        <Card>
          <H2>Demo mode</H2>
          <Body>No server is connected, so this runs on your phone with sample players.</Body>
          <Button title="Open a practice check-in now" onPress={async () => {
            await demoApi.openDemoPing();
            await refreshStatus();
            router.navigate('/home');
          }} />
          <Button title="Reset demo" kind="quiet" onPress={async () => {
            await demoApi.reset();
            await signOut();
          }} />
        </Card>
      ) : null}

      {__DEV__ && !demoMode ? (
        <Card>
          <H2>Testing</H2>
          <Body>Opens a test check-in in 5 seconds so you can try the flow. It scores like a real check-in but never affects your streak. Only shows in development builds.</Body>
          <Button title="Open a check-in in 5 seconds" onPress={async () => {
            try {
              await api.openTestPing(5);
              await scheduleLocalPing(5);
              setTimeout(() => {
                refreshStatus();
                router.navigate('/home');
              }, 5500);
            } catch (e) {
              Alert.alert('Test check-in failed', errorText(e));
            }
          }} />
        </Card>
      ) : null}

      <Button title="Sign out" kind="quiet" onPress={signOut} />
      <Button title="Delete account" kind="danger" onPress={del} />
      <Small center>McFarthest is not affiliated with or endorsed by McDonald's. Store locations come from the open AllThePlaces dataset and are used only to measure distance.</Small>
    </Screen>
  );
}

const s = StyleSheet.create({
  tickHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tickCount: { ...font.value, fontSize: 24, color: colors.ink },
});
