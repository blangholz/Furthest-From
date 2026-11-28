import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { refreshStatus } from '@/lib/status';
import { ONBOARDING_STEPS } from '@/onboarding/steps';
import { colors, space } from '@/ui/theme';
import { PENDING_INVITE_KEY } from '@/lib/invites';

export default function OnboardingStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const i = Math.max(0, ONBOARDING_STEPS.findIndex((x) => x.key === step));
  const { Component } = ONBOARDING_STEPS[i];

  const next = async () => {
    const following = ONBOARDING_STEPS[i + 1];
    if (following) {
      router.push({ pathname: '/onboarding/[step]', params: { step: following.key } });
      return;
    }
    await api.completeOnboarding();
    const code = await AsyncStorage.getItem(PENDING_INVITE_KEY);
    if (code) {
      await api.acceptInvite(code).catch(() => {});
      await AsyncStorage.removeItem(PENDING_INVITE_KEY);
    }
    await refreshStatus(); // flips the guard in _layout, which shows the tabs
  };

  // Each step lays out its own scrolling body and the pinned bottom button (StepScreen).
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
        {ONBOARDING_STEPS.map((x, j) => (
          <View key={x.key} style={{ flex: 1, height: j <= i ? 4 : 1, alignSelf: 'center', backgroundColor: colors.ink }} />
        ))}
      </View>
      <Component next={next} />
    </SafeAreaView>
  );
}
