// "How scoring works": the rules pop-up behind the info button on the leaderboard.
// A Field Notes card (outlined box on the page yellow) over a dimmed screen, one rule
// per ruled row, like the printed rules inside a memo book's cover.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RULES } from '@/lib/rules';
import { Button, Label, Rows, brand } from './kit';
import { colors, font, space, stroke } from './theme';

const time = `${((RULES.pingLocalTime.hour + 11) % 12) + 1}:${String(RULES.pingLocalTime.minute).padStart(2, '0')} ${RULES.pingLocalTime.hour < 12 ? 'AM' : 'PM'}`;

const ITEMS: [string, string][] = [
  ['Check-in', `Once a day at ${time}, your time. You have ${RULES.pingWindowMin} minutes to check in.`],
  ['Points', "One point per mile, as the crow flies, from where you are to the nearest McDonald's."],
  ['Where it counts', 'Only check-ins in the lower 48 score on the leaderboard.'],
  ['Home zone', `Within ${RULES.homeRadiusMi} miles of your home pin scores zero and pauses your streak without breaking it.`],
  ['Passport', "Outside the lower 48: no points, but it keeps your streak going and earns Extra Fries."],
  ['Extra Fries', `A bonus check-in you can use any time. Earn one every ${RULES.friesPerCredits} check-ins away from home, twice as fast on a ${RULES.doubleCreditStreak}-day streak. Each lasts ${RULES.friesTtlDays / 7} weeks.`],
  ['Seasons', 'The board resets on Mar 1, Jun 1, Sep 1 and Dec 1.'],
];

export function RulesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.dim} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={s.card} onPress={() => {}} accessible={false}>
          <Text style={s.title}>{brand('How scoring works')}</Text>
          <ScrollView style={{ flexShrink: 1 }} bounces={false}>
            <Rows>
              {ITEMS.map(([label, text]) => (
                <View key={label} style={s.item}>
                  <Label>{label}</Label>
                  <Text style={s.text}>{brand(text)}</Text>
                </View>
              ))}
            </Rows>
          </ScrollView>
          <Button title="Got it" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(26,26,20,0.55)', justifyContent: 'center', padding: space.lg },
  card: { backgroundColor: colors.bg, borderWidth: stroke, borderColor: colors.ink, padding: space.lg, gap: space.md, maxHeight: '88%' },
  title: { ...font.h2, color: colors.ink },
  item: { paddingVertical: 10, gap: 4 },
  text: { ...font.body, color: colors.ink },
});
