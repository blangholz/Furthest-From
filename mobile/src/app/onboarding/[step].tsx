import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { refreshStatus } from '@/lib/status';
import { ONBOARDING_STEPS } from '@/onboarding/steps';
import { Screen } from '@/ui/kit';
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

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: space.md }}>
        {ONBOARDING_STEPS.map((x, j) => (
          <View key={x.key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: j <= i ? colors.teal : colors.line }} />
        ))}
      </View>
      <Component next={next} />
    </Screen>
  );
}
