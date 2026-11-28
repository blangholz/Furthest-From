// Magic-link and Google sign-in land here (farfromfries://auth-callback?code=...).
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Body, Button, Screen, Title } from '@/ui/kit';

export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const { handleAuthUrl } = useAuth();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    handleAuthUrl(url)
      .then(() => router.replace('/'))
      .catch((e) => setError(String(e?.message ?? e)));
  }, [url, handleAuthUrl]);
  return (
    <Screen>
      <Title>Signing you in…</Title>
      {error ? <Body muted>{error}</Body> : null}
      {error ? <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} /> : null}
    </Screen>
  );
}
