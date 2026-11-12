import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { flushQueue } from '@/lib/offline-queue';
import { deviceTimeZone } from '@/lib/rules';
import { api } from '@/lib/api';
import { clearStatus, refreshStatus, useStatus } from '@/lib/status';
import { registerForPush } from '@/lib/notifications';
import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready, signedIn } = useAuth();
  const { status } = useStatus();

  // On sign-in and every return to the app: report the time zone (the 1:20 PM ping
  // follows it), upload any logs saved while offline, and refresh the status.
  useEffect(() => {
    if (!signedIn) {
      clearStatus();
      return;
    }
    const sync = async () => {
      await api.setTimeZone(deviceTimeZone()).catch(() => {});
      await flushQueue().catch(() => {});
      await refreshStatus();
    };
    sync();
    registerForPush().catch(() => {});
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, [signedIn]);

  const loading = !ready || (signedIn && !status);
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);
  if (loading) return null;

  const onboarded = !!status?.onboarded;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding/[step]" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="spot/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'Spots' }} />
          <Stack.Screen name="friends" options={{ headerShown: true, title: 'Friends', headerBackTitle: 'Back' }} />
          <Stack.Screen name="logs/[zone]" options={{ headerShown: true, title: '', headerBackTitle: 'Back' }} />
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
