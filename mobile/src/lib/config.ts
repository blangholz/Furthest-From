// Settings come from EXPO_PUBLIC_* variables (see mobile/.env.example). With no
// Supabase URL the app runs in demo mode: everything works on the phone with
// sample friends and no account, so the screens can be tried before the backend exists.
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://farfromfries.app',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
};

export const demoMode = !config.supabaseUrl || !config.supabaseAnonKey;
