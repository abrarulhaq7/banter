import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useAuth } from '@/auth';
import { AppText, Button, Screen, ScreenHeader } from '@/components/ui';
import { KeysProvider, ProfileProvider, useProfile } from '@/data';
import { useSignOut } from '@/hooks/use-sign-out';
import { useTheme } from '@/theme';

/** Screens for signed-in users. The guard in the root layout keeps everyone else out. */
export default function AppLayout() {
  const { session } = useAuth();
  const userId = session?.user.id;
  if (!userId) return null;

  // The key makes each user get their own fresh data: nothing carries over on switching.
  return (
    <ProfileProvider key={userId} userId={userId}>
      <KeysProvider userId={userId}>
        <AppNavigator />
      </KeysProvider>
    </ProfileProvider>
  );
}

function AppNavigator() {
  const { colors } = useTheme();
  const { status, profile } = useProfile();

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
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="keys/index" />
        <Stack.Screen name="keys/add" />
        <Stack.Screen name="keys/[id]" />
      </Stack.Protected>

      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding/about" />
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
