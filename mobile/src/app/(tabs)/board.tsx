import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api, type LeaderRow } from '@/lib/api';
import { formatMiles } from '@/lib/geo';
import { useStatus } from '@/lib/status';
import { Body, Card, Loading, Row, Screen, Segmented, Small, Title } from '@/ui/kit';

export default function Board() {
  const { status } = useStatus();
  const [scope, setScope] = useState<'friends' | 'global'>('friends');
  const [period, setPeriod] = useState<'season' | 'all'>('season');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);

  useFocusEffect(useCallback(() => {
    setRows(null);
    api.leaderboard(scope, period).then(setRows).catch(() => setRows([]));
  }, [scope, period]));

  const needFriends = scope === 'global' && status && status.friendCount < status.globalMinFriends;
  return (
    <Screen>
      <Title>Leaderboard</Title>
      <Segmented value={scope} onChange={setScope} options={[{ value: 'friends', label: 'Friends' }, { value: 'global', label: 'Everyone' }]} />
      <Segmented value={period} onChange={setPeriod} options={[{ value: 'season', label: status?.season.name ?? 'Season' }, { value: 'all', label: 'All time' }]} />
      {needFriends ? (
        <Card tone="gold">
          <Body>Add {status!.globalMinFriends - status!.friendCount} more friend{status!.globalMinFriends - status!.friendCount === 1 ? '' : 's'} to appear on the global board.</Body>
        </Card>
      ) : null}
      {!rows ? <Loading /> : (
        <Card>
          {rows.length === 0 ? <Body muted>No scores yet this {period === 'season' ? 'season' : 'time'}.</Body> : null}
          {rows.map((r) => (
            <Row key={r.userId}
              left={<Body>{r.rank}. {r.isMe ? 'You' : r.displayName}</Body>}
              sub={`${r.logs} log${r.logs === 1 ? '' : 's'}`}
              right={<Body>{formatMiles(r.points)}</Body>} />
          ))}
        </Card>
      )}
      <Small>Points are miles from the nearest McDonald's on scored logs in the lower 48. Home check-ins and Passport stamps don't count toward the board.</Small>
      {period === 'season' ? <Small>Seasons reset on Mar 1, Jun 1, Sep 1 and Dec 1.</Small> : null}
    </Screen>
  );
}
