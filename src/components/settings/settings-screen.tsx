import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import { AppText, Banner, Dialog, ListRow, Screen, ScreenHeader } from '@/components/ui';
import { usableKeys, useKeys, useProfile } from '@/data';
import { useSignOut } from '@/hooks/use-sign-out';
import { spacing, useTheme } from '@/theme';

/** The Settings tab: a short menu. Each row opens its own screen. */
export function SettingsScreen() {
  const router = useRouter();
  const { label: themeLabel } = useTheme();
  const { session } = useAuth();
  const { profile } = useProfile();
  const { keys, status: keysStatus } = useKeys();
  const signOut = useSignOut();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignOut = async () => {
    setError(null);
    setBusy(true);
    const result = await signOut();
    setBusy(false);
    setAsking(false);
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
    <Screen testID="settings-screen" edges={['top', 'left', 'right']} contentStyle={styles.content}>
      <View style={styles.header}>
        <ScreenHeader title="Settings" />
        <AppText testID="greeting" color="textMuted">
          {profile?.display_name ? `Hi ${profile.display_name}.` : 'You are signed in.'}
        </AppText>
      </View>

      <View style={styles.list}>
        <ListRow
          testID="edit-profile"
          icon="person"
          title="About you"
          subtitle={session?.user.email ?? 'Unknown email'}
          subtitleTestID="account-email"
          subtitleOneLine
          onPress={() => router.push('/profile')}
        />
        <ListRow
          testID="manage-keys"
          icon="key"
          tone={keysStatus !== 'loading' && active === 0 ? 'warning' : 'accent'}
          title="AI keys"
          subtitle={keySummary}
          subtitleTestID="key-summary"
          onPress={() => router.push(keys.length === 0 ? '/keys/add' : '/keys')}
        />
        <ListRow
          testID="open-theme"
          icon="theme"
          title="Theme"
          value={themeLabel}
          onPress={() => router.push('/theme')}
        />
        <ListRow
          testID="open-data"
          icon="data"
          title="Your data"
          subtitle="Screenshots, usage, deleting."
          onPress={() => router.push('/data')}
        />
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <ListRow
        testID="sign-out-button"
        icon="signOut"
        tone="danger"
        title="Sign out"
        trailing={<View />}
        onPress={() => setAsking(true)}
      />

      <Dialog
        visible={asking}
        tone="danger"
        icon="signOut"
        title="Sign out?"
        message="Your keys and history stay in your account. You will need your password to come back."
        confirmLabel="Sign out"
        busy={busy}
        onConfirm={onSignOut}
        onCancel={() => setAsking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl },
  header: { gap: spacing.xs },
  list: { gap: spacing.sm },
});
