import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** Screens for signed-in users. The guard in the root layout keeps everyone else out. */
export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
