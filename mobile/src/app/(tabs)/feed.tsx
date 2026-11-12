import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type FeedItem } from '@/lib/api';
import { formatMiles } from '@/lib/geo';
import { feedLine, timeAgo } from '@/ui/format';
import { Body, Card, Pill, Row, Small, Title } from '@/ui/kit';
import { colors, space } from '@/ui/theme';

export default function Feed() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setItems(await api.feed().catch(() => []));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <FlatList
        data={items ?? []}
        keyExtractor={(f) => String(f.logId)}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} />}
        ListHeaderComponent={<Title>Friends</Title>}
        ListEmptyComponent={items ? (
          <Card><Body muted>Nothing yet. When you and your friends log, it shows up here.</Body></Card>
        ) : undefined}
        renderItem={({ item }) => (
          <View style={[s.item, item.kind === 'extreme' && s.extreme]}>
            <Row
              left={feedLine(item)}
              sub={timeAgo(item.loggedAt)}
              right={item.zone === 'scoring' ? <Pill text={`+${formatMiles(item.points)}`} /> : item.zone === 'passport' ? <Pill text="Passport" tone="teal" /> : <Small>home</Small>}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  item: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.line },
  extreme: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
});
