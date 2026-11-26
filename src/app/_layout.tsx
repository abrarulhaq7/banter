import { DarkTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { ThemeProvider, useTheme } from '@/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedNavigation />
    </ThemeProvider>
  );
}

/** Passes the active Banter theme to the navigator and to the native window behind it. */
function ThemedNavigation() {
  const { colors } = useTheme();

  useEffect(() => {
    // The native root view shows during screen transitions and keyboard animations.
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  const navigationTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accentAlt,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </NavigationThemeProvider>
  );
}
