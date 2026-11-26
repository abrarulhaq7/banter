import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import { ThemePicker } from '@/components/theme-picker';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { spacing } from '@/theme';

/**
 * Home for signed-in users. A placeholder until onboarding (Phase 2) and the Generate
 * screen (Phase 4) exist.
 */
export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignOut = async () => {
    setError(null);
    setBusy(true);
    const result = await signOut();
    setBusy(false);
    if (!result.ok) setError(result.message);
    // On success the root layout sees the session is gone and shows the sign-in screen.
  };

  return (
    <Screen testID="home-screen">
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Banter
        </AppText>
        <AppText color="textMuted">You are signed in.</AppText>
      </View>

      <Card>
        <AppText variant="caption" color="textMuted">
          Account
        </AppText>
        <AppText testID="account-email" variant="bodyStrong" numberOfLines={1} ellipsizeMode="middle">
          {session?.user.email ?? 'Unknown email'}
        </AppText>
      </Card>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          Theme
        </AppText>
        <ThemePicker />
      </View>

      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button
        testID="sign-out-button"
        variant="secondary"
        label="Sign out"
        onPress={onSignOut}
        loading={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  section: { gap: spacing.md },
});
