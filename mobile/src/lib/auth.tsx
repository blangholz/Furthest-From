import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { demoMode } from './config';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const DEMO_KEY = 'fff-demo-signed-in';
export const authRedirect = () => Linking.createURL('auth-callback');

type AuthValue = {
  ready: boolean;
  signedIn: boolean;
  email: string | null;
  sendMagicLink(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<void>;
  signInWithApple(): Promise<void>;
  signInWithGoogle(): Promise<void>;
  handleAuthUrl(url: string): Promise<boolean>;
  signInDemo(): Promise<void>;
  signOut(): Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [demoSignedIn, setDemoSignedIn] = useState(false);

  useEffect(() => {
    if (demoMode || !supabase) {
      AsyncStorage.getItem(DEMO_KEY).then((v) => {
        setDemoSignedIn(v === '1');
        setReady(true);
      });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const need = () => {
      if (!supabase) throw new Error('Sign-in needs the Supabase settings (see mobile/README.md).');
      return supabase;
    };
    const handleAuthUrl = async (url: string) => {
      const { queryParams } = Linking.parse(url);
      const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
      if (!code || !supabase) return false;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return true;
    };
    return {
      ready,
      signedIn: demoMode ? demoSignedIn : !!session,
      email: session?.user?.email ?? null,
      async sendMagicLink(email) {
        const { error } = await need().auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: authRedirect(), shouldCreateUser: true },
        });
        if (error) throw error;
      },
      async verifyEmailCode(email, code) {
        const { error } = await need().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
        if (error) throw error;
      },
      async signInWithApple() {
        const raw = Crypto.randomUUID();
        const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
        const cred = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashed,
        });
        if (!cred.identityToken) throw new Error('Apple did not return a sign-in token.');
        const { error } = await need().auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: raw });
        if (error) throw error;
        // Apple shares the name only on the first sign-in; keep it as the display name.
        const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
        if (name) await need().auth.updateUser({ data: { full_name: name } });
      },
      async signInWithGoogle() {
        const redirectTo = authRedirect();
        const { data, error } = await need().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error || !data?.url) throw error ?? new Error('Could not start Google sign-in.');
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success') await handleAuthUrl(res.url);
      },
      handleAuthUrl,
      async signInDemo() {
        await AsyncStorage.setItem(DEMO_KEY, '1');
        setDemoSignedIn(true);
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        await AsyncStorage.removeItem(DEMO_KEY);
        setDemoSignedIn(false);
      },
    };
  }, [ready, session, demoSignedIn]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
