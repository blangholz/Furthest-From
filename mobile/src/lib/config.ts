// Settings come from EXPO_PUBLIC_* variables (see mobile/.env.example). With no
// Supabase URL the app runs in demo mode: everything works on the phone with
// sample players and no account, so the screens can be tried before the backend exists.
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://farfromfries.app',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
};

export const demoMode = !config.supabaseUrl || !config.supabaseAnonKey;

// Product switches. Friends are off for the first release: one global leaderboard,
// no friend list, feed or invites. The friendship tables, RPCs and screens all stay
// in place, so turning this back on is the whole job on the app side (see
// docs/GAME_RULES.md and supabase/migrations/20261125000001_global_board_only.sql).
export const features = {
  friends: false,
};
