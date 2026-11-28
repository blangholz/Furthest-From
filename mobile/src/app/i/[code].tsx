// Invite links: https://farfromfries.app/i/<code> (universal link) or farfromfries://i/<code>.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useStatus } from '@/lib/status';
import { Body, Button, Screen, Title } from '@/ui/kit';

import { PENDING_INVITE_KEY } from '@/lib/invites';

export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { signedIn } = useAuth();
  const { status } = useStatus();
  const [msg, setMsg] = useState('Adding your friend…');

  useEffect(() => {
    if (!code) return;
    if (!signedIn || !status?.onboarded) {
      // Accept once they've signed up (see onboarding/[step].tsx).
      AsyncStorage.setItem(PENDING_INVITE_KEY, code).then(() => router.replace('/'));
      return;
    }
    api
      .acceptInvite(code)
      .then((r) => setMsg(r.status === 'own_invite' ? "That's your own invite link." : `You and ${r.friend ?? 'your friend'} are now friends.`))
      .catch((e) => setMsg(errorText(e)));
  }, [code, signedIn, status?.onboarded]);

  return (
    <Screen>
      <Title>Invite</Title>
      <Body>{msg}</Body>
      <Button title="Go to the app" onPress={() => router.replace('/')} />
    </Screen>
  );
}
