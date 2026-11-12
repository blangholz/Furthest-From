// State Extremes and Top 100 Spots: tick lists of the furthest points from any
// McDonald's, on accessible public land. Claim one by standing within 150 ft.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { api, type Spot } from '@/lib/api';
import { formatMiles, haversineMi } from '@/lib/geo';
import { useLiveLocation } from '@/lib/location';
import { Body, Card, H2, Loading, Pill, Row, Screen, Segmented, Small, Title } from '@/ui/kit';

export default function Spots() {
  const [tab, setTab] = useState<'state' | 'top100'>('state');
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const { pos } = useLiveLocation(true);

  useFocusEffect(useCallback(() => {
    api.spots().then(setSpots).catch(() => setSpots([]));
  }, []));

  const list = useMemo(() => {
    const l = (spots ?? []).filter((s) => s.kind === tab);
    return tab === 'state' ? l.sort((a, b) => a.stateName.localeCompare(b.stateName)) : l.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }, [spots, tab]);

  const claimed = list.filter((s) => s.claimed).length;
  const nearestOpen = useMemo(() => {
    if (!pos) return null;
    let best: { spot: Spot; mi: number } | null = null;
    for (const s of list) if (!s.claimed) {
      const mi = haversineMi(pos, s);
      if (!best || mi < best.mi) best = { spot: s, mi };
    }
    return best;
  }, [pos, list]);

  return (
    <Screen>
      <Title>Extremes</Title>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'state', label: 'State Extremes' }, { value: 'top100', label: 'Top 100' }]} />
      <Body muted>
        {tab === 'state'
          ? "The furthest point from any McDonald's in each state, on public land you can visit."
          : "The 100 furthest points in the lower 48, each at least 50 miles from the others, on public land."}
      </Body>
      {!spots ? <Loading /> : (
        <>
          <Card tone="gold">
            <H2>{claimed} of {list.length} claimed</H2>
            {nearestOpen ? (
              <Row
                onPress={() => router.push({ pathname: '/spot/[id]', params: { id: String(nearestOpen.spot.id) } })}
                left={`Nearest unclaimed: ${label(nearestOpen.spot)}`}
                sub={`${formatMiles(nearestOpen.mi)} miles from you`}
                right="›"
              />
            ) : null}
          </Card>
          <Card>
            {list.map((s) => (
              <Row
                key={s.id}
                onPress={() => router.push({ pathname: '/spot/[id]', params: { id: String(s.id) } })}
                left={label(s)}
                sub={`${formatMiles(s.distanceMi)} mi from fries${pos ? ` · ${formatMiles(haversineMi(pos, s))} mi from you` : ''}`}
                right={s.claimed ? <Pill text="✓ Claimed" tone="teal" /> : '›'}
              />
            ))}
          </Card>
          <Small>Spots are refreshed monthly as McDonald's open and close. Your ticks are permanent.</Small>
        </>
      )}
    </Screen>
  );
}

const label = (s: Spot) => (s.kind === 'top100' ? `#${s.rank} · ${s.stateName}` : s.stateName);
