import { Children, Fragment, isValidElement, type ReactNode, type RefObject } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { capsNudge, colors, font, fonts, radius, space, stroke } from './theme';

// Field Notes kit (Spec Decision #27, canvas direction A): one flat page color,
// 1pt ink outlines around sections, label/value rows split by thin rules, one
// solid ink button per screen. No fills, no rounded corners.

// The keyboard-avoiding wrapper shrinks the screen to the space above the
// keyboard, so anything scrolled into view is never hidden behind it.
export function Screen({ children, scroll = true, refreshControl, edges, scrollRef }: {
  children: ReactNode; scroll?: boolean; refreshControl?: React.ReactElement<RefreshControlProps>; edges?: ('top' | 'bottom')[];
  scrollRef?: RefObject<ScrollViewInstance | null>;
}) {
  return (
    <SafeAreaView style={s.screen} edges={edges ?? ['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {scroll ? (
          <ScrollView ref={scrollRef} contentContainerStyle={s.content} refreshControl={refreshControl}
            keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {children}
          </ScrollView>
        ) : (
          <View style={[s.content, { flex: 1 }]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// All text is set in caps, except the lowercase "c" in Mc names: McFarthest
// and McDonald's read "McFARTHEST" and "McDONALD'S" (Decision #27).
const keepC = { textTransform: 'none' as const };
const MC = /\bMc(?=[A-Z])/;
export function brand(children: ReactNode): ReactNode {
  if (Array.isArray(children)) return children.map((c, i) => <Fragment key={i}>{brand(c)}</Fragment>);
  if (typeof children !== 'string' || !MC.test(children)) return children;
  return children.split(new RegExp(MC, 'g')).flatMap((part, i) =>
    i === 0 ? [part] : [<Fragment key={i}>M<Text style={keepC}>c</Text></Fragment>, part]);
}

export const Title = ({ children }: { children: ReactNode }) => <Text style={s.title}>{brand(children)}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{brand(children)}</Text>;
export const Body = ({ children, muted, center }: { children: ReactNode; muted?: boolean; center?: boolean }) => (
  <Text style={[s.body, muted && { color: colors.muted }, center && { textAlign: 'center' }]}>{brand(children)}</Text>
);
export const Small = ({ children, center }: { children: ReactNode; center?: boolean }) => (
  <Text style={[s.small, center && { textAlign: 'center' }]}>{brand(children)}</Text>
);
/** Small spaced caps that name a box or a field ("MILES FROM THE NEAREST McDONALD'S"). */
export const Label = ({ children }: { children: ReactNode }) => <Text style={s.label}>{brand(children)}</Text>;

/** A section: a thin-stroked box, optionally named by a small label at the top. */
export function Card({ children, label, style }: { children: ReactNode; label?: string; style?: ViewStyle }) {
  return (
    <View style={[s.card, style]}>
      {label ? <Label>{label}</Label> : null}
      {children}
    </View>
  );
}

/** Stacks Rows with a thin rule between each (none above the first or below the last). */
export function Rows({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View>
      {items.map((child, i) => (
        <View key={child.key ?? i} style={i > 0 && s.rule}>{child}</View>
      ))}
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', busy, disabled }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; busy?: boolean; disabled?: boolean;
}) {
  const solid = kind === 'primary';
  const fg = solid ? colors.bg : kind === 'danger' ? colors.bad : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.button,
        solid && { backgroundColor: colors.ink },
        kind === 'secondary' && s.outline,
        (kind === 'quiet' || kind === 'danger') && s.quiet,
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <Text style={[solid || kind === 'secondary' ? s.buttonText : s.quietText, { color: fg }]}>{brand(title)}</Text>
      )}
    </Pressable>
  );
}

/** Label on the left, value on the right. `highlight` draws a 2pt box around it (your own leaderboard row). */
export function Row({ left, right, sub, onPress, highlight }: {
  left: ReactNode; right?: ReactNode; sub?: ReactNode; onPress?: () => void; highlight?: boolean;
}) {
  const inner = (
    <View style={[s.row, highlight && s.rowHighlight]}>
      <View style={{ flex: 1 }}>
        {typeof left === 'string' ? <Text style={s.body}>{brand(left)}</Text> : left}
        {sub ? <Text style={[s.small, { marginTop: 2 }]}>{brand(sub)}</Text> : null}
      </View>
      {right != null ? (typeof right === 'string' || typeof right === 'number' ? <Text style={s.rowRight}>{brand(right)}</Text> : right) : null}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{inner}</Pressable> : inner;
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)} style={[s.segItem, value === o.value && s.segOn]}>
          <Text style={[s.segText, { color: value === o.value ? colors.bg : colors.ink }]}>{brand(o.label)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Pill = ({ text }: { text: string }) => (
  <View style={s.pill}>
    <Text style={[s.small, { color: colors.ink }]}>{brand(text)}</Text>
  </View>
);

/** 44pt tap target holding a thin SF Symbol (Material symbol on Android). */
export function IconButton({ icon, android, label, onPress, fallback }: {
  icon: string; android: string; label: string; onPress: () => void; fallback?: ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [s.iconButton, { opacity: pressed ? 0.6 : 1 }]}>
      <SymbolView name={{ ios: icon, android } as never} size={24} weight="light" tintColor={colors.ink} fallback={fallback ?? <PersonGlyph />} />
    </Pressable>
  );
}

/** The burger mark beside the wordmark: a solid ink silhouette (domed bun, patty, flat bun),
 *  drawn from the canvas's 24-unit icon so it needs no SVG library. */
export function BurgerMark({ size = 26 }: { size?: number }) {
  const u = size / 24;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', paddingTop: 4 * u }}>
      <View style={{ width: 18 * u, height: 7 * u, backgroundColor: colors.ink, borderTopLeftRadius: 9 * u, borderTopRightRadius: 9 * u }} />
      <View style={{ width: 20 * u, height: 3 * u, marginTop: 1.5 * u, backgroundColor: colors.ink, borderRadius: 1.5 * u }} />
      <View style={{ width: 18 * u, height: 3 * u, marginTop: 1.5 * u, backgroundColor: colors.ink, borderBottomLeftRadius: 2 * u, borderBottomRightRadius: 2 * u }} />
    </View>
  );
}

/** Drawn "i" in a circle, the web-preview stand-in for the info symbol. */
export const InfoGlyph = () => (
  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ ...fonts.condensed, textTransform: 'none', fontSize: 15, color: colors.ink, marginTop: 2 }}>i</Text>
  </View>
);

// Drawn stand-in where symbols aren't available (web previews).
const PersonGlyph = () => (
  <View style={{ alignItems: 'center' }}>
    <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: colors.ink }} />
    <View style={{ width: 18, height: 8, marginTop: 2, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderWidth: 1.5, borderBottomWidth: 0, borderColor: colors.ink }} />
  </View>
);

export const Gap = ({ size = space.md }: { size?: number }) => <View style={{ height: size }} />;

export const Loading = () => (
  <View style={{ padding: space.xxl, alignItems: 'center' }}>
    <ActivityIndicator color={colors.ink} />
  </View>
);

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 120, gap: space.lg },
  title: { ...font.title, color: colors.ink },
  h2: { ...font.h2, color: colors.ink },
  body: { ...font.body, color: colors.ink },
  small: { ...font.small, color: colors.muted },
  label: { ...font.label, color: colors.ink },
  card: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderWidth: stroke, borderColor: colors.ink, gap: space.sm },
  rule: { borderTopWidth: stroke, borderTopColor: colors.ink },
  button: { borderRadius: radius.md, paddingVertical: 17, paddingHorizontal: space.lg, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  outline: { borderWidth: stroke, borderColor: colors.ink, paddingVertical: 16 },
  quiet: { paddingVertical: 12, minHeight: 44 },
  buttonText: { ...fonts.condensed, fontSize: 22, letterSpacing: 2, ...capsNudge(22) },
  quietText: { ...fonts.condensed, fontSize: 18, letterSpacing: 1.5, textDecorationLine: 'underline', ...capsNudge(18) },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: space.md, minHeight: 44 },
  rowHighlight: { borderWidth: 2, borderColor: colors.ink, marginHorizontal: -space.sm, paddingHorizontal: space.sm - 2 },
  rowRight: { ...font.value, color: colors.ink, marginTop: 5 },
  seg: { flexDirection: 'row', borderWidth: stroke, borderColor: colors.ink, borderRadius: radius.sm },
  segItem: { flex: 1, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { ...fonts.condensed, fontSize: 16, letterSpacing: 1.5, ...capsNudge(16) },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 0, borderWidth: stroke, borderColor: colors.ink },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
