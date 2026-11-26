// The leaderboard, shown as a section at the bottom of Home (scroll down past the radar).
// Current season only for now (no all-time view). Reloads when Home gains focus and on
// pull-to-refresh (Home bumps refreshKey).
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api, type LeaderRow } from '@/lib/api';
import { features } from '@/lib/config';
import { formatMiles } from '@/lib/geo';
import { useStatus } from '@/lib/status';
import { View } from 'react-native';
import { Body, Card, H2, Loading, Row, Segmented, Small } from '@/ui/kit';
import { space } from '@/ui/theme';

export function Leaderboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { status } = useStatus();
  // With friends off there is only the global board.
  const [scope, setScope] = useState<'friends' | 'global'>(features.friends ? 'friends' : 'global');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);

  useFocusEffect(useCallback(() => {
    let live = true;
    setRows(null);
    api.leaderboard(scope, 'season')
      .then((r) => { if (live) setRows(r); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [scope, refreshKey]));

  const needFriends = features.friends && scope === 'global' && status && status.friendCount < status.globalMinFriends;
  return (
    <>
      <View style={{ marginTop: space.xxl }}>
        <H2>Leaderboard</H2>
      </View>
      {status?.season.name ? <Small>{status.season.name}</Small> : null}
      {features.friends ? (
        <Segmented value={scope} onChange={setScope} options={[{ value: 'friends', label: 'Friends' }, { value: 'global', label: 'Everyone' }]} />
      ) : null}
      {needFriends ? (
        <Card tone="gold">
          <Body>Add {status!.globalMinFriends - status!.friendCount} more friend{status!.globalMinFriends - status!.friendCount === 1 ? '' : 's'} to appear on the global board.</Body>
        </Card>
      ) : null}
      {!rows ? <Loading /> : (
        <Card>
          {rows.length === 0 ? <Body muted>No scores yet this season.</Body> : null}
          {rows.map((r) => (
            <Row key={r.userId} highlight={r.isMe}
              left={<Body>{r.rank}. {r.displayName}</Body>}
              sub={`${r.logs} check-in${r.logs === 1 ? '' : 's'}`}
              right={<Body>{formatMiles(r.points)}</Body>} />
          ))}
        </Card>
      )}
      <Small>Points are miles from the nearest McDonald's on scored check-ins in the lower 48. Home check-ins and Passport stamps don't count toward the board.</Small>
      <Small>Seasons reset on Mar 1, Jun 1, Sep 1 and Dec 1.</Small>
    </>
  );
}
