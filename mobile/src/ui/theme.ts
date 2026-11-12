// Generic branding: fry gold on cream with a deep teal. Deliberately not
// McDonald's red and yellow (App Store and trademark risk, see docs).
export const colors = {
  bg: '#FFF8EC',
  card: '#FFFFFF',
  ink: '#1F1A14',
  muted: '#7A6F62',
  line: '#EADFCB',
  gold: '#F2A900',
  goldSoft: '#FCE9B6',
  teal: '#0F5257',
  tealSoft: '#D6E8E6',
  good: '#2E7D32',
  warn: '#B26A00',
  bad: '#B3261E',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 22 };
export const font = {
  huge: { fontSize: 88, fontWeight: '800' as const, letterSpacing: -3, fontVariant: ['tabular-nums' as const] },
  title: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 16 },
  small: { fontSize: 13 },
};
