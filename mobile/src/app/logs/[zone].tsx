import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { api, type MyLog } from '@/lib/api';
import { formatMiles } from '@/lib/geo';
import { Body, Card, Loading, Row, Screen, Small } from '@/ui/kit';

export default function Logs() {
  const { zone } = useLocalSearchParams<{ zone: 'passport' | 'home' }>();
  const [logs, setLogs] = useState<MyLog[] | null>(null);
  useEffect(() => {
    api.myLogs(zone === 'home' ? 'home' : 'passport').then(setLogs).catch(() => setLogs([]));
  }, [zone]);
  const title = zone === 'home' ? 'Home log' : 'Passport';
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title }} />
      <Small>
        {zone === 'home'
          ? 'Check-ins from inside your home zone. They score zero and pause your streak without breaking it.'
          : "Logs outside the lower 48. They don't count on the leaderboards, but they keep your streak going and earn Extra Fries."}
      </Small>
      {!logs ? <Loading /> : (
        <Card>
          {logs.length === 0 ? <Body muted>Nothing here yet.</Body> : null}
          {logs.map((l) => (
            <Row key={l.id}
              left={zone === 'home' ? 'Home check-in' : `${l.regionName ?? 'Abroad'}`}
              sub={new Date(l.loggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              right={`${formatMiles(l.distanceMi)} mi`} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
