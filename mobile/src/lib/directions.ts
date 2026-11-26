import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

type Point = { lat: number; lon: number };
export type MapsApp = { name: string; url: string; probe?: string };

// iOS map apps we know how to hand driving directions to. Apple Maps is always
// installed; the others need their scheme in LSApplicationQueriesSchemes (app.json)
// so canOpenURL can see them.
export function mapsApps({ lat, lon }: Point): MapsApp[] {
  const ll = `${lat},${lon}`;
  return [
    { name: 'Apple Maps', url: `https://maps.apple.com/?daddr=${ll}&dirflg=d` },
    { name: 'Google Maps', url: `comgooglemaps://?daddr=${ll}&directionsmode=driving`, probe: 'comgooglemaps://' },
    { name: 'Waze', url: `waze://?ll=${ll}&navigate=yes`, probe: 'waze://' },
  ];
}

async function installed(apps: MapsApp[]): Promise<MapsApp[]> {
  const ok = await Promise.all(apps.map((a) => (a.probe ? Linking.canOpenURL(a.probe).catch(() => false) : true)));
  return apps.filter((_, i) => ok[i]);
}

const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert("Couldn't open maps"));

// Opens a native picker of the user's map apps. Android's geo: intent shows the
// system chooser itself; on iOS we build an action sheet from what's installed.
export async function openDirections(to: Point, label: string) {
  if (Platform.OS !== 'ios') {
    return open(`geo:0,0?q=${to.lat},${to.lon}(${encodeURIComponent(label)})`);
  }
  const apps = await installed(mapsApps(to));
  if (apps.length === 1) return open(apps[0].url);
  ActionSheetIOS.showActionSheetWithOptions(
    { title: `Directions to ${label}`, options: [...apps.map((a) => a.name), 'Cancel'], cancelButtonIndex: apps.length },
    (i) => {
      if (i < apps.length) open(apps[i].url);
    },
  );
}
