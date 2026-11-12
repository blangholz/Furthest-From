import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { useAuth } from '@/lib/auth';
import { demoMode } from '@/lib/config';
import { Body, Button, Card, Gap, Screen, Small } from '@/ui/kit';
import { colors, font, radius, space } from '@/ui/theme';

export default function SignIn() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const run = (key: string, fn: () => Promise<void>) => async () => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Sign-in problem', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Gap size={space.xxl} />
      <Text style={s.logo}>🍟</Text>
      <Text style={s.name}>Far From Fries</Text>
      <Body center muted>
        Once a day, at 1:20 PM, see how far you are from the nearest McDonald's. Get out there and beat your friends.
      </Body>
      <Gap size={space.xl} />

      {demoMode ? (
        <Card tone="gold">
          <Body>Demo mode: the app isn't connected to a server yet, so everything runs on this phone with sample friends.</Body>
          <Button title="Try the demo" busy={busy === 'demo'} onPress={run('demo', auth.signInDemo)} />
        </Card>
      ) : (
        <>
          {Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.md}
              style={{ height: 52 }}
              onPress={run('apple', auth.signInWithApple)}
            />
          ) : null}
          <Button title="Continue with Google" kind="secondary" busy={busy === 'google'} onPress={run('google', auth.signInWithGoogle)} />
          <Gap />
          <Card>
            {!sent ? (
              <>
                <Body>Or get a sign-in link by email</Body>
                <TextInput
                  style={s.input}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <Button
                  title="Email me a link"
                  disabled={!/.+@.+\..+/.test(email)}
                  busy={busy === 'email'}
                  onPress={run('email', async () => {
                    await auth.sendMagicLink(email);
                    setSent(true);
                  })}
                />
              </>
            ) : (
              <>
                <Body>Check {email}. Tap the link on this phone, or type the 6-digit code from the email.</Body>
                <TextInput style={s.input} placeholder="123456" keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} />
                <Button title="Sign in with code" disabled={code.length < 6} busy={busy === 'code'} onPress={run('code', () => auth.verifyEmailCode(email, code))} />
                <Button title="Use a different email" kind="quiet" onPress={() => setSent(false)} />
              </>
            )}
          </Card>
        </>
      )}
      <Gap size={space.xl} />
      <Small center>Not affiliated with or endorsed by McDonald's. Store locations are used only to measure distance.</Small>
    </Screen>
  );
}

const s = StyleSheet.create({
  logo: { fontSize: 72, textAlign: 'center' },
  name: { ...font.title, fontSize: 34, textAlign: 'center', color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space.md, fontSize: 17, backgroundColor: '#fff' },
});
