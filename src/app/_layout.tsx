import {
  DarkTheme,
  SplashScreen,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/auth';
import { ThemeProvider, useTheme } from '@/theme';

// Keep the splash screen up until the saved session has been read, so a signed-in user
// never sees the sign-in screen flash by.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { colors } = useTheme();
  const { status } = useAuth();
  const signedIn = status === 'signedIn';

  useEffect(() => {
    // The native root view shows during screen transitions and keyboard animations.
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

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
        }}>
        {/* Signed-in users get the app. Everyone else gets only the sign-in screens. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>

        {/* Design preview: development builds only, never in a build given to users. */}
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="foundation" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}
