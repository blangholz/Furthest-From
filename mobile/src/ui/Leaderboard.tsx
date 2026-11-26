// The leaderboard, shown as a section at the bottom of Home (scroll down past the check-in).
// Current season only for now (no all-time view). Reloads when Home gains focus and on
// pull-to-refresh (Home bumps refreshKey).
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api, type LeaderRow } from '@/lib/api';
import { features } from '@/lib/config';
import { formatMiles } from '@/lib/geo';
import { useStatus } from '@/lib/status';
import { View } from 'react-native';
import { Body, Card, IconButton, InfoGlyph, Loading, Row, Rows, Segmented, Title } from '@/ui/kit';
import { RulesSheet } from '@/ui/RulesSheet';
import { space } from '@/ui/theme';

export function Leaderboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { status } = useStatus();
  // With friends off there is only the global board.
  const [scope, setScope] = useState<'friends' | 'global'>(features.friends ? 'friends' : 'global');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

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
    <View style={{ marginTop: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: -10 }}>
        <Title>Leaderboard</Title>
        <IconButton icon="info.circle" android="info" label="How scoring works" onPress={() => setRulesOpen(true)} fallback={<InfoGlyph />} />
      </View>
      {features.friends ? (
        <Segmented value={scope} onChange={setScope} options={[{ value: 'friends', label: 'Friends' }, { value: 'global', label: 'Everyone' }]} />
      ) : null}
      {needFriends ? (
        <Card>
          <Body>Add {status!.globalMinFriends - status!.friendCount} more friend{status!.globalMinFriends - status!.friendCount === 1 ? '' : 's'} to appear on the global board.</Body>
        </Card>
      ) : null}
      {!rows ? <Loading /> : (
        <Card label={status?.season.name ? `Season · ${status.season.name}` : 'This season'}>
          {rows.length === 0 ? <Body muted>No scores yet this season.</Body> : (
            <Rows>
              {rows.map((r) => (
                <Row key={r.userId} highlight={r.isMe}
                  left={<Body>{r.rank}. {r.displayName}</Body>}
                  sub={`${r.logs} check-in${r.logs === 1 ? '' : 's'}`}
                  right={`${formatMiles(r.points)} pts`} />
              ))}
            </Rows>
          )}
        </Card>
      )}
      <RulesSheet visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </View>
  );
}
