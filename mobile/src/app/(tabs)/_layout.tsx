import { NativeTabs } from 'expo-router/native-tabs';
import { colors } from '@/ui/theme';

export default function Tabs() {
  return (
    <NativeTabs backgroundColor={colors.bg} tintColor={colors.teal}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Distance</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="location.north.circle.fill" md="explore" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="board">
        <NativeTabs.Trigger.Label>Leaderboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy.fill" md="trophy" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="spots">
        <NativeTabs.Trigger.Label>Extremes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="flag.checkered" md="flag" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
