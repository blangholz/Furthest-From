// Onboarding, as a plain ordered list of steps. Benjamin will wireframe and
// iterate on this flow, so each step is self-contained: reorder, add or drop
// steps by editing ONBOARDING_STEPS. A step calls next() when it's done.
import { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Circle, Marker, type MapPressEvent } from 'react-native-maps';
import { api, errorText } from '@/lib/api';
import { config } from '@/lib/config';
import { currentFix, ensureForegroundPermission } from '@/lib/location';
import { notificationPermission, registerForPush } from '@/lib/notifications';
import { RULES } from '@/lib/rules';
import { Body, Button, Card, Gap, Small, Title } from '@/ui/kit';
import { colors, radius, space } from '@/ui/theme';

export type StepProps = { next: () => void };
export type Step = { key: string; Component: (p: StepProps) => React.ReactElement };

function Welcome({ next }: StepProps) {
  return (
    <>
      <Text style={{ fontSize: 64 }}>🍟</Text>
      <Title>How far from fries are you?</Title>
      <Body>Every day at 1:20 PM your phone pings. Open the app within an hour and you score a point for every mile, as the crow flies, between you and the nearest McDonald's.</Body>
      <Body>Near home doesn't count. Getting out does.</Body>
      <Body muted>Your friends only ever see your distance, never where you are.</Body>
      <Gap />
      <Button title="Let's go" onPress={next} />
    </>
  );
}

function Name({ next }: StepProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Title>What should friends call you?</Title>
      <TextInput style={s.input} placeholder="Name (shown to friends)" value={displayName} onChangeText={setDisplayName} maxLength={40} />
      <TextInput style={s.input} placeholder="username" autoCapitalize="none" autoCorrect={false} value={username}
        onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={20} />
      <Small>Friends find you by username. 3 to 20 letters, numbers or underscores.</Small>
      <Button title="Next" busy={busy} disabled={username.length < 3 || !displayName.trim()} onPress={async () => {
        setBusy(true);
        try {
          await api.updateProfile({ username, displayName });
          next();
        } catch (e) {
          Alert.alert('Hmm', errorText(e));
        } finally {
          setBusy(false);
        }
      }} />
    </>
  );
}

function LocationStep({ next }: StepProps) {
  return (
    <>
      <Title>Location, only while you use it</Title>
      <Body>Far From Fries reads your location only when the app is open: to show your live distance, log a ping, or claim a spot. No background tracking.</Body>
      <Body>Your exact spot is used to work out the distance and then thrown away. It's never saved or shown to anyone.</Body>
      <Small>Choose "Allow While Using App" on the next screen.</Small>
      <Gap />
      <Button title="Turn on location" onPress={async () => {
        const ok = await ensureForegroundPermission();
        if (!ok) Alert.alert('Location is off', 'You can turn it on later in Settings > Far From Fries > Location.');
        next();
      }} />
    </>
  );
}

function HomePin({ next }: StepProps) {
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    currentFix().then((f) => setPin({ lat: f.lat, lon: f.lon })).catch(() => setPin({ lat: 39.5296, lon: -119.8138 }));
  }, []);
  return (
    <>
      <Title>Where's home?</Title>
      <Body>Logs within {RULES.homeRadiusMi} miles of home score zero. Drop the pin on home (tap the map to move it). Only you can see it, and it stays put for the season.</Body>
      <View style={s.map}>
        {pin ? (
          <MapView style={{ flex: 1 }} initialRegion={{ latitude: pin.lat, longitude: pin.lon, latitudeDelta: 0.25, longitudeDelta: 0.25 }}
            onPress={(e: MapPressEvent) => setPin({ lat: e.nativeEvent.coordinate.latitude, lon: e.nativeEvent.coordinate.longitude })}>
            <Marker coordinate={{ latitude: pin.lat, longitude: pin.lon }} draggable
              onDragEnd={(e) => setPin({ lat: e.nativeEvent.coordinate.latitude, lon: e.nativeEvent.coordinate.longitude })} />
            <Circle center={{ latitude: pin.lat, longitude: pin.lon }} radius={RULES.homeRadiusMi * 1609.344}
              strokeColor={colors.teal} fillColor="rgba(15,82,87,0.12)" />
          </MapView>
        ) : null}
      </View>
      <Button title="Set home here" busy={busy} disabled={!pin} onPress={async () => {
        if (!pin) return;
        setBusy(true);
        try {
          await api.setHome(pin.lat, pin.lon);
          next();
        } catch (e) {
          Alert.alert('Hmm', errorText(e));
        } finally {
          setBusy(false);
        }
      }} />
    </>
  );
}

function Notifications({ next }: StepProps) {
  return (
    <>
      <Title>Don't miss the ping</Title>
      <Body>Every day at 1:20 PM, wherever you are, you get one ping and an hour to log. You'll also hear when a friend logs a big one.</Body>
      <Gap />
      <Button title="Turn on notifications" onPress={async () => {
        await notificationPermission(true);
        await registerForPush().catch(() => {});
        next();
      }} />
      <Button title="Not now" kind="quiet" onPress={next} />
    </>
  );
}

function Friends({ next }: StepProps) {
  const [username, setUsername] = useState('');
  const invite = async () => {
    try {
      const code = await api.createInvite();
      await Share.share({ message: `Play Far From Fries with me: ${config.webUrl}/i/${code}` });
    } catch (e) {
      Alert.alert('Hmm', errorText(e));
    }
  };
  return (
    <>
      <Title>Bring your friends</Title>
      <Body>Far From Fries is better with friends. Send an invite link or add someone by username.</Body>
      <Button title="Share an invite link" kind="secondary" onPress={invite} />
      <Card>
        <TextInput style={s.input} placeholder="Friend's username" autoCapitalize="none" value={username} onChangeText={setUsername} />
        <Button title="Send request" kind="quiet" disabled={username.length < 3} onPress={async () => {
          try {
            await api.requestFriend(username);
            Alert.alert('Sent', `Friend request sent to ${username}.`);
            setUsername('');
          } catch (e) {
            Alert.alert('Hmm', errorText(e));
          }
        }} />
      </Card>
      <Gap />
      <Button title="Start playing" onPress={next} />
    </>
  );
}

export const ONBOARDING_STEPS: Step[] = [
  { key: 'welcome', Component: Welcome },
  { key: 'name', Component: Name },
  { key: 'location', Component: LocationStep },
  { key: 'home', Component: HomePin },
  { key: 'notifications', Component: Notifications },
  { key: 'friends', Component: Friends },
];

const s = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space.md, fontSize: 17, backgroundColor: '#fff' },
  map: { height: 320, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.line },
});
