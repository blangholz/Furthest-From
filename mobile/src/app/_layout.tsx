import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { flushQueue } from '@/lib/offline-queue';
import { deviceTimeZone } from '@/lib/rules';
import { api, errorText } from '@/lib/api';
import { Body, Button, Screen, Title } from '@/ui/kit';
import { clearStatus, refreshStatus, useStatus } from '@/lib/status';
import { registerForPush } from '@/lib/notifications';
import { colors, fonts } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready, signedIn, signOut } = useAuth();
  const { status, error } = useStatus();
  const [retrying, setRetrying] = useState(false);

  // On sign-in and every return to the app: report the time zone (the 1:20 PM ping
  // follows it), upload any logs saved while offline, and refresh the status.
  useEffect(() => {
    if (!signedIn) {
      clearStatus();
      return;
    }
    const sync = async () => {
      await api.ensureProfile().catch(() => {});
      await api.setTimeZone(deviceTimeZone()).catch(() => {});
      await flushQueue().catch(() => {});
      await refreshStatus();
    };
    sync().then(() => registerForPush().catch(() => {}));
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, [signedIn]);

  // Signed in but the status couldn't load (server error, no connection, timeout):
  // show why and offer a retry instead of a blank screen.
  const failed = ready && signedIn && !status && !!error;
  const loading = !ready || (signedIn && !status && !error);
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);
  if (loading) return null;
  if (failed) {
    return (
      <>
        <StatusBar style="dark" />
        <Screen scroll={false}>
          <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
            <Title>Couldn't load your game</Title>
            <Body>{errorText(error)}</Body>
            <Button title="Try again" busy={retrying} onPress={async () => {
              setRetrying(true);
              await refreshStatus();
              setRetrying(false);
            }} />
            <Button title="Sign out" kind="quiet" onPress={signOut} />
          </View>
        </Screen>
      </>
    );
  }

  const onboarded = !!status?.onboarded;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerShown: false, contentStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontFamily: fonts.condensed.fontFamily, fontWeight: '700', fontSize: 20 },
        headerBackTitleStyle: { fontFamily: fonts.condensed.fontFamily, fontSize: 17 },
      }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding/[step]" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="spot/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'SPOTS' }} />
          <Stack.Screen name="friends" options={{ headerShown: true, title: 'FRIENDS', headerBackTitle: 'BACK' }} />
          <Stack.Screen name="logs/[zone]" options={{ headerShown: true, title: '', headerBackTitle: 'BACK' }} />
        </Stack.Protected>
        <Stack.Screen name="i/[code]" />
        <Stack.Screen name="auth-callback" />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
