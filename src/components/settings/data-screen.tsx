import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, Dialog, ListRow, Screen, ScreenHeader, useToast } from '@/components/ui';
import { savesScreenshots, useProfile } from '@/data';
import { profileSettings } from '@/data/settings';
import { useHistory } from '@/history';
import { useSignOut } from '@/hooks/use-sign-out';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme';

type Job = 'screenshots' | 'history' | 'account';

/**
 * Settings > Your data: what Banter keeps and how to remove it. A short menu; the two
 * deletions ask first, in the danger colour.
 */
export function DataScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, save } = useProfile();
  const history = useHistory();
  const signOut = useSignOut();

  const [asking, setAsking] = useState<null | 'history' | 'account'>(null);
  const [busy, setBusy] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saving = savesScreenshots(profile);
  const idle = busy === null;

  const toggleScreenshots = async () => {
    setError(null);
    setBusy('screenshots');
    const result = await save({ settings: { ...profileSettings(profile), save_screenshots: !saving } });
    setBusy(null);
    if (!result.ok) return setError(result.message);
    haptics.tap();
    toast.show(saving ? 'Screenshots will not be saved' : 'Screenshots will be saved');
  };

  const deleteHistory = async () => {
    setError(null);
    setBusy('history');
    const result = await history.removeAllHistory();
    setBusy(null);
    setAsking(null);
    if (!result.ok) return setError(result.message);
    toast.show('History deleted');
  };

  const deleteAccount = async () => {
    setError(null);
    setBusy('account');
    const result = await history.deleteAccount();
    if (!result.ok) {
      setBusy(null);
      setAsking(null);
      return setError(result.message);
    }
    toast.show('Account deleted');
    // The login is gone. Signing out here clears this phone and shows the sign-in screen.
    await signOut();
  };

  return (
    <Screen testID="data-screen" fill>
      <ScreenHeader
        title="Your data"
        subtitle="What Banter keeps, and how to remove it."
        onBack={() => router.back()}
      />

      {error ? (
        <Banner tone="danger" messageTestID="data-error">
          {error}
        </Banner>
      ) : null}

      <View style={styles.list}>
        <ListRow
          testID="save-screenshots"
          icon="screenshot"
          title="Save screenshots"
          subtitle={
            saving
              ? 'Kept with your history, so you can see what each line was for.'
              : 'Off. New lines are saved without the picture.'
          }
          value={saving ? 'On' : 'Off'}
          trailing={<View />}
          onPress={toggleScreenshots}
          busy={busy === 'screenshots'}
          disabled={!idle}
        />
        <ListRow
          testID="open-usage"
          icon="usage"
          title="Usage"
          subtitle="How many generations each key has made."
          onPress={() => router.push('/usage')}
          disabled={!idle}
        />
      </View>

      <View style={styles.list}>
        <ListRow
          testID="delete-history"
          icon="delete"
          tone="danger"
          title="Delete all history"
          subtitle="People, lines and screenshots. Your keys and tones stay."
          trailing={<View />}
          onPress={() => setAsking('history')}
          disabled={!idle}
        />
        <ListRow
          testID="delete-account"
          icon="danger"
          tone="danger"
          title="Delete my account"
          subtitle="Everything, including your login."
          trailing={<View />}
          onPress={() => setAsking('account')}
          disabled={!idle}
        />
      </View>

      <Dialog
        visible={asking === 'history'}
        tone="danger"
        icon="delete"
        title="Delete all history?"
        message="Every person, every line and every saved screenshot will be removed. This cannot be undone."
        confirmLabel="Delete"
        busy={busy === 'history'}
        onConfirm={deleteHistory}
        onCancel={() => setAsking(null)}
      />
      <Dialog
        visible={asking === 'account'}
        tone="danger"
        icon="danger"
        title="Delete your account?"
        message="Your login, keys, tones, history and screenshots will be removed for good. You cannot sign in again with this account."
        confirmLabel="Delete"
        busy={busy === 'account'}
        onConfirm={deleteAccount}
        onCancel={() => setAsking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
