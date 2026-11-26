import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Platform, StyleSheet, Text, TextInput, type ScrollViewInstance } from 'react-native';
import { useAuth } from '@/lib/auth';
import { demoMode } from '@/lib/config';
import { Body, brand, Button, Card, Gap, H2, Screen, Small } from '@/ui/kit';
import { colors, font, fonts, radius, space } from '@/ui/theme';

export default function SignIn() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // The email card is the last thing on the screen, so when the keyboard opens,
  // scroll to the end: the field and its submit button then sit right above it.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => sub.remove();
  }, []);

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

  const validEmail = /.+@.+\..+/.test(email);
  const sendLink = run('email', async () => {
    await auth.sendMagicLink(email.trim());
    setSent(true);
  });

  return (
    <Screen scrollRef={scrollRef}>
      <Gap size={space.xxl} />
      <Text style={s.name} adjustsFontSizeToFit numberOfLines={1}>{brand('McFarthest')}</Text>
      <H2>How far can you get from the nearest McDonald's?</H2>
      <Body muted>
        Once a day, at 1:20 PM, see how far you are from the nearest McDonald's. One mile is one point. Get out there and climb the leaderboard.
      </Body>
      <Gap size={space.lg} />

      {demoMode ? (
        <Card>
          <Body>Demo mode: the app isn't connected to a server yet, so everything runs on this phone with sample players.</Body>
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
          <Card label={sent ? 'Check your email' : 'Or sign in by email'}>
            {!sent ? (
              <>
                <TextInput
                  style={s.input}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={() => { if (validEmail) sendLink(); }}
                />
                <Button
                  title="Email me a link"
                  disabled={!validEmail}
                  busy={busy === 'email'}
                  onPress={sendLink}
                />
              </>
            ) : (
              <>
                <Body>Check {email}. Tap the link on this phone, or type or paste the code from the email.</Body>
                <TextInput
                  style={s.input}
                  placeholder="123456"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  value={code}
                  // Pasted codes can carry spaces, a newline or surrounding text,
                  // and a hard maxLength makes iOS reject the whole paste. Keep the
                  // digits only, up to Supabase's longest code length (10).
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 10))}
                />
                <Button title="Sign in with code" disabled={code.length < 6} busy={busy === 'code'} onPress={run('code', () => auth.verifyEmailCode(email, code))} />
                <Button title="Use a different email" kind="quiet" onPress={() => setSent(false)} />
              </>
            )}
          </Card>
        </>
      )}
      <Gap size={space.xl} />
      <Small>Not affiliated with or endorsed by McDonald's. Store locations are used only to measure distance.</Small>
    </Screen>
  );
}

const s = StyleSheet.create({
  name: { ...font.title, fontSize: 64, lineHeight: 64, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.ink, borderRadius: radius.sm, padding: space.md, fontSize: 17, ...fonts.input },
});
