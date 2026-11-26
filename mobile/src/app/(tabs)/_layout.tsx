import { NativeTabs } from 'expo-router/native-tabs';
import { features } from '@/lib/config';
import { colors, fonts } from '@/ui/theme';

// Native tab labels can't take textTransform, so the labels are written in caps.
export default function Tabs() {
  return (
    <NativeTabs backgroundColor={colors.bg} tintColor={colors.teal}
      labelStyle={{ fontFamily: fonts.condensed.fontFamily, fontWeight: '700', fontSize: 12 }}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>DISTANCE</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="location.north.circle.fill" md="explore" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed" hidden={!features.friends}>
        <NativeTabs.Trigger.Label>FRIENDS</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="spots">
        <NativeTabs.Trigger.Label>EXTREMES</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="flag.checkered" md="flag" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>ME</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
