// Field Notes meets a summit register (Spec Decision #27): #EED202 background,
// dark ink, thin rules, sharp corners. Rest of the palette predates the restyle.
export const colors = {
  bg: '#EED202',
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

// Type: DIN Condensed for titles, headings, buttons and labels; DIN Alternate
// for body text and numbers. Both ship with iOS (bold weight only), so nothing
// is bundled. Android has no DIN, so it falls back to Roboto Condensed / Roboto.
// Everything the app writes is ALL CAPS; text people type stays as typed.
import { Platform } from 'react-native';
const DIN_CONDENSED = Platform.select({ ios: 'DIN Condensed', android: 'sans-serif-condensed', default: undefined });
const DIN_ALTERNATE = Platform.select({ ios: 'DIN Alternate', android: 'sans-serif-medium', default: undefined });
const caps = { textTransform: 'uppercase' as const };

export const fonts = {
  condensed: { fontFamily: DIN_CONDENSED, fontWeight: '700' as const, ...caps },
  alternate: { fontFamily: DIN_ALTERNATE, fontWeight: '700' as const, ...caps },
  /** For TextInputs: the DIN face without forcing caps on what people type. */
  input: { fontFamily: DIN_ALTERNATE },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
// Field Notes look: sharp corners everywhere (Decision #27).
export const radius = { sm: 0, md: 0, lg: 0 };
export const font = {
  huge: { ...fonts.alternate, fontSize: 88, letterSpacing: -2, fontVariant: ['tabular-nums' as const] },
  title: { ...fonts.condensed, fontSize: 32, letterSpacing: 0.5 },
  h2: { ...fonts.condensed, fontSize: 22, letterSpacing: 0.5 },
  body: { ...fonts.alternate, fontSize: 15, lineHeight: 21, letterSpacing: 0.4 },
  small: { ...fonts.alternate, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
};
