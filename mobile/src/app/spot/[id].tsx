import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { api, errorText, type Spot } from '@/lib/api';
import { features } from '@/lib/config';
import { formatFeet, formatMiles, haversineMi, miToFt } from '@/lib/geo';
import { currentFix, useLiveLocation } from '@/lib/location';
import { RULES } from '@/lib/rules';
import { refreshStatus } from '@/lib/status';
import { Body, Button, Card, H2, Label, Loading, Pill, Screen, Small, Title } from '@/ui/kit';
import { formatLatLon } from '@/ui/format';
import { colors, radius } from '@/ui/theme';

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [busy, setBusy] = useState(false);
  const { pos } = useLiveLocation(true);

  const load = () => api.spots().then((l) => setSpot(l.find((s) => String(s.id) === id) ?? null));
  useEffect(() => {
    load();
  }, [id]);

  if (!spot) return <Screen><Loading /></Screen>;
  const ft = pos ? miToFt(haversineMi(pos, spot)) : null;
  const inRange = ft != null && ft <= RULES.claimRadiusFt;
  const name = spot.kind === 'top100' ? `Top 100 #${spot.rank}` : spot.stateName;

  const claim = async () => {
    setBusy(true);
    try {
      const fix = await currentFix();
      const r = await api.submitLog({ lat: fix.lat, lon: fix.lon, kind: 'extreme', extremeId: spot.id });
      Alert.alert('Ticked!', `${name}: ${formatMiles(r.distanceMi)} miles from the nearest McDonald's.${features.friends ? ' Your friends have been told.' : ''}`);
      await Promise.all([load(), refreshStatus()]);
    } catch (e) {
      Alert.alert('Not ticked', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: name }} />
      <Title>{name}</Title>
      {spot.kind === 'top100' ? <Body muted>{spot.stateName}</Body> : null}
      {spot.claimed ? <Pill text={`Ticked ${new Date(spot.claimedAt!).toLocaleDateString()}`} /> : null}
      <Card label="Miles from the nearest McDonald's">
        <H2>{formatMiles(spot.distanceMi)} mi</H2>
        {spot.land ? <Small>On {spot.land.replace(/ \((\w+), OA\)$/, ' ($1)')}</Small> : null}
        <Label>{formatLatLon(spot)}</Label>
      </Card>
      <View style={s.map}>
        <MapView style={{ flex: 1 }} showsUserLocation mapType="hybrid"
          initialRegion={{ latitude: spot.lat, longitude: spot.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
          <Marker coordinate={{ latitude: spot.lat, longitude: spot.lon }} pinColor={colors.bg} />
          <Circle center={{ latitude: spot.lat, longitude: spot.lon }} radius={RULES.claimRadiusFt * 0.3048}
            strokeColor={colors.bg} fillColor="rgba(238,210,2,0.25)" />
        </MapView>
      </View>
      <Body>{ft == null ? 'Finding you…' : inRange ? "You're here. Tick it." : `You're ${formatFeet(ft)} away. Get within ${RULES.claimRadiusFt} ft to tick it.`}</Body>
      {!spot.claimed ? <Button title="Tick it" busy={busy} disabled={!inRange} onPress={claim} /> : null}
      <Button title="Directions in Maps" kind="secondary" onPress={() => Linking.openURL(`https://maps.apple.com/?daddr=${spot.lat},${spot.lon}&dirflg=d`)} />
      <Small>Remote spots can be far from roads, water and cell service. Check access, weather and land rules before you go, and carry what you need.</Small>
    </Screen>
  );
}

const s = StyleSheet.create({ map: { height: 300, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink } });
