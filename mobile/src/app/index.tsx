// Entry: send people to the right place. The guards in _layout decide what exists.
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useStatus } from '@/lib/status';
import { ONBOARDING_STEPS } from '@/onboarding/steps';

export default function Index() {
  const { signedIn } = useAuth();
  const { status } = useStatus();
  if (!signedIn) return <Redirect href="/sign-in" />;
  if (!status?.onboarded) {
    return <Redirect href={{ pathname: '/onboarding/[step]', params: { step: ONBOARDING_STEPS[0].key } }} />;
  }
  return <Redirect href="/(tabs)/home" />;
}
