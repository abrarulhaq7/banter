import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import { ThemePicker } from '@/components/theme-picker';
import { AppText, Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { usableKeys, useKeys, useProfile } from '@/data';
import { useSignOut } from '@/hooks/use-sign-out';
import { spacing } from '@/theme';

/** Account, keys, theme and sign out. */
export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const { keys, status: keysStatus } = useKeys();
  const signOut = useSignOut();
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

  const active = usableKeys(keys).length;
  const keySummary =
    keysStatus === 'loading'
      ? 'Loading your keys.'
      : keys.length === 0
        ? 'No key yet. Add one to start generating lines.'
        : `${keys.length} ${keys.length === 1 ? 'key' : 'keys'} saved, ${active} active.`;

  return (
    <Screen testID="settings-screen">
      <View style={styles.header}>
        <ScreenHeader title="Settings" onBack={() => router.back()} />
        <AppText testID="greeting" color="textMuted">
          {profile?.display_name ? `Hi ${profile.display_name}.` : 'You are signed in.'}
        </AppText>
      </View>

      <Card>
        <AppText variant="caption" color="textMuted">
          Account
        </AppText>
        <AppText testID="account-email" variant="bodyStrong" numberOfLines={1} ellipsizeMode="middle">
          {session?.user.email ?? 'Unknown email'}
        </AppText>
        <Button
          testID="edit-profile"
          variant="ghost"
          size="sm"
          label="Edit about you"
          style={styles.cardAction}
          onPress={() => router.push('/profile')}
        />
      </Card>

      <Card>
        <AppText variant="caption" color="textMuted">
          AI keys
        </AppText>
        <AppText testID="key-summary">{keySummary}</AppText>
        <Button
          testID="manage-keys"
          variant="ghost"
          size="sm"
          label={keys.length === 0 ? 'Add a key' : 'Manage keys'}
          style={styles.cardAction}
          onPress={() => router.push(keys.length === 0 ? '/keys/add' : '/keys')}
        />
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
  cardAction: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
