import { Fragment, type ReactNode, type RefObject } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, fonts, radius, space } from './theme';

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

// Sections are thin-stroked boxes on the page color, never a fill (Spec
// Decision #27). `tone` is kept for callers but no longer changes the look.
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle; tone?: 'gold' | 'teal' }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', busy, disabled }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; busy?: boolean; disabled?: boolean;
}) {
  const bg = { primary: colors.teal, secondary: colors.gold, quiet: 'transparent', danger: 'transparent' }[kind];
  const fg = { primary: '#fff', secondary: colors.ink, quiet: colors.teal, danger: colors.bad }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        (kind === 'quiet' || kind === 'danger') && s.quiet]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, { color: fg }]}>{brand(title)}</Text>}
    </Pressable>
  );
}

export function Row({ left, right, sub, onPress }: { left: ReactNode; right?: ReactNode; sub?: ReactNode; onPress?: () => void }) {
  const inner = (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        {typeof left === 'string' ? <Text style={s.body}>{brand(left)}</Text> : left}
        {sub ? <Text style={[s.small, { marginTop: 2 }]}>{brand(sub)}</Text> : null}
      </View>
      {right != null ? (typeof right === 'string' || typeof right === 'number' ? <Text style={s.rowRight}>{brand(right)}</Text> : right) : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segItem, value === o.value && s.segOn]}>
          <Text style={[s.small, { color: value === o.value ? colors.bg : colors.ink, fontWeight: '600' }]}>{brand(o.label)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Pill = ({ text }: { text: string; tone?: 'gold' | 'teal' | 'muted' }) => (
  <View style={s.pill}>
    <Text style={[s.small, { color: colors.ink, fontWeight: '600' }]}>{brand(text)}</Text>
  </View>
);

export const Gap = ({ size = space.md }: { size?: number }) => <View style={{ height: size }} />;

export const Loading = () => (
  <View style={{ padding: space.xxl, alignItems: 'center' }}>
    <ActivityIndicator color={colors.teal} />
  </View>
);

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 120, gap: space.md },
  title: { ...font.title, color: colors.ink },
  h2: { ...font.h2, color: colors.ink },
  body: { ...font.body, color: colors.ink },
  small: { ...font.small, color: colors.muted },
  card: { borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: colors.ink, gap: space.sm },
  button: { borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: space.lg, alignItems: 'center' },
  quiet: { paddingVertical: 10 },
  buttonText: { ...fonts.condensed, fontSize: 21, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, gap: space.md },
  rowRight: { ...font.body, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: colors.ink, borderRadius: radius.sm, padding: 3 },
  segItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm - 2 },
  segOn: { backgroundColor: colors.ink },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 0, borderWidth: 1, borderColor: colors.ink },
});
