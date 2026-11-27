import {
  DarkTheme,
  SplashScreen,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/auth';
import { CrashScreen } from '@/components/crash-screen';
import { ToastProvider } from '@/components/ui';
import { DEFAULT_THEME, ThemeProvider, readSavedTheme, saveTheme, useTheme, type ThemeName } from '@/theme';

// Keep the splash screen up until the saved session has been read, so a signed-in user
// never sees the sign-in screen flash by.
void SplashScreen.preventAutoHideAsync();

/** Expo Router shows this in place of any screen that crashes while rendering. */
export { CrashScreen as ErrorBoundary };

export default function RootLayout() {
  /** undefined: not read yet. null: nothing saved on this phone. */
  const [savedTheme, setSavedTheme] = useState<ThemeName | null | undefined>(undefined);

  useEffect(() => {
    let current = true;
    void readSavedTheme().then((name) => {
      if (current) setSavedTheme(name);
    });
    return () => {
      current = false;
    };
  }, []);

  // The splash screen stays up until the theme is known, so the app never opens in the
  // wrong colours and then changes.
  if (savedTheme === undefined) return null;

  return (
    <ThemeProvider initialTheme={savedTheme ?? DEFAULT_THEME} onThemeChange={(name) => void saveTheme(name)}>
      <AuthProvider>
        {/* Toasts ("Copied") are drawn above whichever screen is open. */}
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
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
          {/* Sign in and sign up share one screen. */}
          <Stack.Screen name="sign-in" />
        </Stack.Protected>

        {/* Design preview: development builds only, never in a build given to users. */}
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="foundation" />
          <Stack.Screen name="crash-test" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}
