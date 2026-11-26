import { Tabs } from 'expo-router/js-tabs';

import { Icon, type IconName } from '@/components/ui';
import { fontFamily, useTheme } from '@/theme';

const icon = (name: IconName) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={name} size={22} color={focused ? 'accent' : 'textMuted'} />;
  };

/** The bottom tab bar, in the app's own theme colours. */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.body, fontWeight: '500', fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Generate', tabBarButtonTestID: 'tab-generate', tabBarIcon: icon('generate') }}
      />
      <Tabs.Screen
        name="people"
        options={{ title: 'People', tabBarButtonTestID: 'tab-people', tabBarIcon: icon('people') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarButtonTestID: 'tab-settings', tabBarIcon: icon('settings') }}
      />
    </Tabs>
  );
}
