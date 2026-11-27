// Field Notes meets a summit register (Spec Decision #27, direction A on the
// design canvas): one flat #EED202 page, dark ink, 1pt outlined boxes, no fills,
// sharp corners. The only solid shapes are the primary button and stamped ticks.
export const colors = {
  bg: '#EED202',
  ink: '#1A1A14',
  muted: '#4A4410', // 6.8:1 on the yellow, so small labels stay readable
  bad: '#8E1B12',
};

/** Outline weight for every box and divider. */
export const stroke = 1;

// Type: DIN Condensed for titles, headings, buttons and labels; DIN Alternate
// for body text and numbers. Both ship with iOS (bold weight only), so nothing
// is bundled. Android has no DIN, so it falls back to Roboto Condensed / Roboto.
// Everything the app writes is ALL CAPS; text people type stays as typed.
import { Platform } from 'react-native';
// Web (previews only) asks for the same DIN faces, which Macs have installed.
const DIN_CONDENSED = Platform.select({ ios: 'DIN Condensed', android: 'sans-serif-condensed', default: '"DIN Condensed", sans-serif' });
const DIN_ALTERNATE = Platform.select({ ios: 'DIN Alternate', android: 'sans-serif-medium', default: '"DIN Alternate", sans-serif' });
const caps = { textTransform: 'uppercase' as const };

export const fonts = {
  condensed: { fontFamily: DIN_CONDENSED, fontWeight: '700' as const, ...caps },
  alternate: { fontFamily: DIN_ALTERNATE, fontWeight: '700' as const, ...caps },
  /** For TextInputs: the DIN face without forcing caps on what people type. */
  input: { fontFamily: DIN_ALTERNATE },
};

/** DIN Condensed keeps a tall descender area, so its caps sit high in the line box.
 *  Shift caps-only button text down by this much so it centers in its button
 *  (measured on device: ~0.17 em; bug reports #5 and #6). */
export const capsNudge = (fontSize: number) => ({ transform: [{ translateY: Math.round(fontSize * 0.17) }] });

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
// Field Notes look: sharp corners everywhere (Decision #27).
export const radius = { sm: 0, md: 0, lg: 0 };
export const font = {
  huge: { ...fonts.alternate, fontSize: 96, letterSpacing: -2, fontVariant: ['tabular-nums' as const] }, // DIN Alternate per Decision #36
  title: { ...fonts.condensed, fontSize: 40, letterSpacing: 1 },
  h2: { ...fonts.condensed, fontSize: 24, letterSpacing: 1 },
  label: { ...fonts.alternate, fontSize: 12, lineHeight: 16, letterSpacing: 1.5 },
  value: { ...fonts.condensed, fontSize: 20, letterSpacing: 1, fontVariant: ['tabular-nums' as const] },
  body: { ...fonts.alternate, fontSize: 15, lineHeight: 21, letterSpacing: 0.4 },
  small: { ...fonts.alternate, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
};
