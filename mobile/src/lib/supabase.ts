import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { config, demoMode } from './config';

export const supabase = demoMode
  ? null
  : createClient(config.supabaseUrl, config.supabaseAnonKey, {
      // Far From Fries lives in its own "fff" schema so it can share a Supabase
      // project with other apps. Add "fff" to the project's exposed API schemas.
      db: { schema: 'fff' },
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
    });

// Refresh the session only while the app is in the foreground.
if (supabase) {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
