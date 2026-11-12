import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Share } from 'react-native';
import { api, demoApi, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config, demoMode } from '@/lib/config';
import { formatMiles } from '@/lib/geo';
import { pendingCount } from '@/lib/offline-queue';
import { RULES } from '@/lib/rules';
import { refreshStatus, useStatus } from '@/lib/status';
import { Body, Button, Card, H2, Row, Screen, Small, Title } from '@/ui/kit';

export default function Me() {
  const { status } = useStatus();
  const { signOut } = useAuth();
  const [pending, setPending] = useState(0);
  const [ticks, setTicks] = useState({ state: 0, top100: 0 });

  useFocusEffect(useCallback(() => {
    refreshStatus();
    pendingCount().then(setPending);
    api.spots().then((l) => setTicks({
      state: l.filter((s) => s.kind === 'state' && s.claimed).length,
      top100: l.filter((s) => s.kind === 'top100' && s.claimed).length,
    })).catch(() => {});
  }, []));

  if (!status) return <Screen><Title>Me</Title></Screen>;

  const invite = async () => {
    try {
      const code = await api.createInvite();
      await Share.share({ message: `Play Far From Fries with me: ${config.webUrl}/i/${code}` });
    } catch (e) {
      Alert.alert('Hmm', errorText(e));
    }
  };

  const del = () =>
    Alert.alert('Delete your account?', 'This removes your profile, scores, ticks and friends for good.', [
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

  return (
    <Screen>
      <Title>{status.displayName || 'Me'}</Title>
      {status.username ? <Body muted>@{status.username}</Body> : null}

      <Card>
        <Row left="Season points" sub={status.season.name} right={formatMiles(status.seasonPoints)} />
        <Row left="All-time points" right={formatMiles(status.allTimePoints)} />
        <Row left="Streak" sub={`Best ${status.bestStreak}`} right={`🔥 ${status.streak}`} />
        <Row left="State Extremes" right={`${ticks.state}`} />
        <Row left="Top 100 Spots" right={`${ticks.top100}`} />
      </Card>

      <Card>
        <H2>Extra Fries 🍟</H2>
        <Body>{status.friesCredits} of {status.friesPer} pings toward your next one{status.streak >= RULES.doubleCreditStreak ? ' (double speed on your streak!)' : ''}.</Body>
        {status.extraFries.length === 0 ? <Small>You don't have any right now.</Small> : status.extraFries.map((f) => (
          <Row key={f.id} left="Extra Fries" right={`expires ${new Date(f.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} />
        ))}
        <Small>Earn one every {RULES.friesPerCredits} pings away from home. At a {RULES.doubleCreditStreak}-day streak they come twice as fast. Each lasts 2 weeks.</Small>
      </Card>

      <Card>
        <Row left="Friends" sub={`${status.friendCount} friend${status.friendCount === 1 ? '' : 's'}`} right="›" onPress={() => router.push('/friends')} />
        <Row left="Passport" sub="Logs outside the lower 48" right="›" onPress={() => router.push({ pathname: '/logs/[zone]', params: { zone: 'passport' } })} />
        <Row left="Home log" sub="Check-ins from your home zone" right="›" onPress={() => router.push({ pathname: '/logs/[zone]', params: { zone: 'home' } })} />
        <Button title="Invite a friend" kind="secondary" onPress={invite} />
      </Card>

      <Card>
        <H2>Home</H2>
        <Body>{status.hasHome ? `Your home pin is locked until ${status.homeLockedUntil ? new Date(status.homeLockedUntil).toLocaleDateString() : 'next season'}. You can move it when the next season starts.` : 'No home pin set.'}</Body>
        <Small>Only you can see your home pin. Logs within {RULES.homeRadiusMi} miles of it score zero.</Small>
      </Card>

      {pending > 0 ? <Card tone="gold"><Body>{pending} log{pending === 1 ? '' : 's'} waiting to upload. They'll go when you're back online.</Body></Card> : null}

      {demoMode ? (
        <Card tone="teal">
          <H2>Demo mode</H2>
          <Body>No server is connected, so this runs on your phone with sample friends.</Body>
          <Button title="Open a practice ping now" onPress={async () => {
            await demoApi.openDemoPing();
            await refreshStatus();
            router.navigate('/(tabs)/home');
          }} />
          <Button title="Reset demo" kind="quiet" onPress={async () => {
            await demoApi.reset();
            await signOut();
          }} />
        </Card>
      ) : null}

      <Button title="Sign out" kind="quiet" onPress={signOut} />
      <Button title="Delete account" kind="danger" onPress={del} />
      <Small center>Far From Fries is not affiliated with or endorsed by McDonald's. Store locations come from the open AllThePlaces dataset and are used only to measure distance.</Small>
    </Screen>
  );
}
