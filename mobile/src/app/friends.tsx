import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, TextInput, View } from 'react-native';
import { api, errorText, type Friend } from '@/lib/api';
import { config } from '@/lib/config';
import { formatMiles } from '@/lib/geo';
import { refreshStatus } from '@/lib/status';
import { Body, Button, Card, H2, Row, Screen, Small } from '@/ui/kit';
import { colors, radius, space } from '@/ui/theme';

export default function Friends() {
  const [list, setList] = useState<Friend[]>([]);
  const [username, setUsername] = useState('');
  const load = useCallback(() => {
    api.friends().then(setList).catch(() => {});
    refreshStatus();
  }, []);
  useFocusEffect(load);

  const add = async () => {
    try {
      const r = await api.requestFriend(username);
      Alert.alert(r === 'accepted' ? 'Friends!' : 'Request sent', r === 'accepted' ? `You and ${username} are friends.` : `We'll let ${username} know.`);
      setUsername('');
      load();
    } catch (e) {
      Alert.alert('Hmm', errorText(e));
    }
  };

  const incoming = list.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = list.filter((f) => f.status === 'pending' && !f.incoming);
  const friends = list.filter((f) => f.status === 'accepted');

  return (
    <Screen edges={[]}>
      <Card>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput style={s.input} placeholder="Add by username" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
          <Button title="Add" disabled={username.length < 3} onPress={add} />
        </View>
        <Button title="Share an invite link" kind="secondary" onPress={async () => {
          const code = await api.createInvite();
          await Share.share({ message: `Play Far From Fries with me: ${config.webUrl}/i/${code}` });
        }} />
      </Card>

      {incoming.length ? (
        <Card tone="gold">
          <H2>Requests</H2>
          {incoming.map((f) => (
            <View key={f.userId} style={{ gap: space.xs }}>
              <Row left={f.displayName} sub={f.username ? `@${f.username}` : undefined} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}><Button title="Accept" onPress={() => api.respondFriend(f.userId, true).then(load)} /></View>
                <View style={{ flex: 1 }}><Button title="Decline" kind="quiet" onPress={() => api.respondFriend(f.userId, false).then(load)} /></View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <H2>Friends</H2>
        {friends.length === 0 ? <Body muted>No friends yet. Invite a few: it's more fun with rivals.</Body> : null}
        {friends.map((f) => (
          <Row key={f.userId} left={f.displayName} sub={`🔥 ${f.streak ?? 0} · ${formatMiles(f.seasonPoints ?? 0)} pts this season`}
            onPress={() => Alert.alert(f.displayName, undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove friend', style: 'destructive', onPress: () => api.removeFriend(f.userId).then(load) },
            ])} />
        ))}
      </Card>

      {outgoing.length ? (
        <Card>
          <Small>Waiting on: {outgoing.map((f) => f.displayName).join(', ')}</Small>
        </Card>
      ) : null}
      <Small>Friends see your distances, streak and ticks. Never your location.</Small>
    </Screen>
  );
}

const s = StyleSheet.create({
  input: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space.md, fontSize: 17, backgroundColor: '#fff' },
});
