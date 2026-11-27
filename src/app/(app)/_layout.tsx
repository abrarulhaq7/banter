import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useAuth } from '@/auth';
import { CrashScreen } from '@/components/crash-screen';
import { AppText, Button, Screen, ScreenHeader } from '@/components/ui';
import { KeysProvider, ProfileProvider, useProfile } from '@/data';
import { GenerateProvider } from '@/generate/generate-provider';
import { HistoryProvider } from '@/history';
import { PromptsProvider } from '@/prompts';
import { useSignOut } from '@/hooks/use-sign-out';
import { isThemeName, useTheme } from '@/theme';

/** A crash in a signed-in screen is caught here, without signing the user out. */
export { CrashScreen as ErrorBoundary };

/** Screens for signed-in users. The guard in the root layout keeps everyone else out. */
export default function AppLayout() {
  const { session } = useAuth();
  const userId = session?.user.id;
  if (!userId) return null;

  // The key makes each user get their own fresh data: nothing carries over on switching.
  return (
    <ProfileProvider key={userId} userId={userId}>
      <KeysProvider userId={userId}>
        <HistoryProvider userId={userId}>
          <PromptsProvider userId={userId}>
            {/* Above the navigator, so the Generate tab and the Results screen share it. */}
            <GenerateProvider>
              <AppNavigator />
            </GenerateProvider>
          </PromptsProvider>
        </HistoryProvider>
      </KeysProvider>
    </ProfileProvider>
  );
}

function AppNavigator() {
  const { colors, name: themeName, setTheme } = useTheme();
  const { status, profile } = useProfile();

  // The theme saved in the profile wins when it arrives, so the choice follows the user to
  // another phone. Picking a theme saves it to the profile (see the Theme screen).
  const profileTheme = profile?.theme;
  useEffect(() => {
    if (isThemeName(profileTheme) && profileTheme !== themeName) setTheme(profileTheme);
    // Only when the profile's theme changes: a theme just picked here must not be undone
    // by the old value while it is still being saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileTheme]);

  if (status === 'loading') {
    return (
      <Screen testID="loading-screen" scroll={false} contentStyle={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (status === 'error') return <ProfileLoadFailed />;

  const onboarded = Boolean(profile?.onboarded_at);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      {/* New users go through onboarding once; everyone else gets the app. */}
      <Stack.Protected guard={onboarded}>
        {/* The tabs. Every other screen opens on top of them, with a Back button. */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="results" />
        <Stack.Screen name="people/[id]/index" />
        <Stack.Screen name="people/[id]/[shot]" />
        <Stack.Screen name="tones/[key]" />
        <Stack.Screen name="tones/new" />
        <Stack.Screen name="tones/learn" />
        <Stack.Screen name="tones/tune" />
        <Stack.Screen name="tones/personalise" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="theme" />
        <Stack.Screen name="data" />
        <Stack.Screen name="usage" />
        <Stack.Screen name="keys/index" />
        <Stack.Screen name="keys/add" />
        <Stack.Screen name="keys/[id]" />
      </Stack.Protected>

      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding/about" />
        <Stack.Screen name="onboarding/voice" />
        <Stack.Screen name="onboarding/first-key" />
      </Stack.Protected>
    </Stack>
  );
}

/** Shown when the profile cannot be loaded and the phone has no saved copy of it. */
function ProfileLoadFailed() {
  const { error, reload } = useProfile();
  const signOut = useSignOut();
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    await reload();
    setBusy(false);
  };

  return (
    <Screen testID="profile-load-failed">
      <ScreenHeader title="Could not load your account" subtitle={error ?? undefined} />
      <Button label="Try again" onPress={retry} loading={busy} />
      <Button variant="ghost" label="Sign out" onPress={signOut} disabled={busy} />
      <AppText variant="caption" color="textMuted">
        Your data is safe. Banter just could not reach it right now.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
});
