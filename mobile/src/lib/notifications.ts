import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function notificationPermission(ask: boolean): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted || !ask) return cur.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Gets this phone's Expo push token and saves it to the player's account. */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice || api.mode === 'demo') return null;
  if (!(await notificationPermission(false))) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Pings', importance: Notifications.AndroidImportance.HIGH });
  }
  // The EAS project id is written into app config by `eas init` (see mobile/README.md).
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.registerPushToken(token, Platform.OS);
  return token;
}
