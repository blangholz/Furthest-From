// Ticks: one square per state (and DC), seven across, like boxes on a printed
// tick list. A ticked state is stamped solid ink, the only filled shape besides
// the primary button. Tap a square to open that spot.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Spot } from '@/lib/api';
import { colors, fonts, stroke } from './theme';

const COLS = 7;
const GAP = 4;

export function TickGrid({ spots }: { spots: Spot[] }) {
  const [width, setWidth] = useState(0);
  // Exact fraction (no rounding) so seven squares fill the row edge to edge.
  const cell = width > 0 ? (width - GAP * (COLS - 1)) / COLS - 0.01 : 0;
  const sorted = [...spots].sort((a, b) => a.state.localeCompare(b.state));
  return (
    <View style={s.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {cell > 0 && sorted.map((spot) => (
        <Pressable
          key={spot.id}
          accessibilityRole="button"
          accessibilityLabel={`${spot.stateName}${spot.claimed ? ', ticked' : ''}`}
          onPress={() => router.push({ pathname: '/spot/[id]', params: { id: String(spot.id) } })}
          style={({ pressed }) => [s.cell, { width: cell, height: Math.max(44, cell * 0.8), opacity: pressed ? 0.6 : 1 },
            spot.claimed && { backgroundColor: colors.ink }]}>
          <Text style={[s.code, { color: spot.claimed ? colors.bg : colors.ink }]}>{spot.state}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { borderWidth: stroke, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  code: { ...fonts.condensed, fontSize: 17, letterSpacing: 1, marginTop: 2 },
});
