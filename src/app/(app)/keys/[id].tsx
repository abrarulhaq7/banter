import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Screen, ScreenHeader, TextField } from '@/components/ui';
import { defaultModelFor, modelsFor, useKeys, type Result } from '@/data';
import { checkKey } from '@/providers/check-key';
import { PROVIDERS, maskKey } from '@/providers/providers';
import { spacing } from '@/theme';

/** Edit one key: rename, change model, check it again, turn it off, delete it. */
export default function EditKeyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { keys, models, updateKey, removeKey } = useKeys();
  const key = keys.find((item) => item.id === id);

  const [label, setLabel] = useState(key?.label ?? '');
  const [busy, setBusy] = useState<null | 'save' | 'check' | 'toggle' | 'delete'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!key) {
    return (
      <Screen testID="edit-key-screen">
        <ScreenHeader title="Key not found" subtitle="It may have been deleted." onBack={() => router.back()} />
      </Screen>
    );
  }

  const info = PROVIDERS[key.provider];
  const providerModels = modelsFor(models, key.provider);
  const selectedModelId = key.model ?? defaultModelFor(models, key.provider)?.model_id ?? null;

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<Result>, done?: string) => {
    setError(null);
    setNotice(null);
    setBusy(kind);
    const result = await action();
    setBusy(null);
    if (!result.ok) setError(result.message);
    else if (done) setNotice(done);
    return result.ok;
  };

  const saveLabel = () => {
    const next = label.trim();
    if (!next) return setError('Give the key a name.');
    void run('save', () => updateKey(key.id, { label: next }), 'Saved.');
  };

  const checkAgain = () =>
    run('check', async () => {
      const checked = await checkKey(key.provider, key.key);
      if (checked.ok) {
        // A key that was switched off stays off; checking only clears a bad status.
        const status = key.status === 'disabled' ? 'disabled' : 'active';
        const saved = await updateKey(key.id, { status, last_error: null });
        if (saved.ok) setNotice(`${info.label} accepted this key.`);
        return saved;
      }
      if (checked.reason === 'invalid') {
        await updateKey(key.id, { status: 'invalid', last_error: checked.message });
      }
      return { ok: false, message: checked.message };
    });

  const toggle = () =>
    run('toggle', () =>
      updateKey(key.id, { status: key.status === 'disabled' ? 'active' : 'disabled', last_error: null }),
    );

  const confirmDelete = () =>
    Alert.alert('Delete this key?', `"${key.label}" will be removed from Banter. Your history is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await run('delete', () => removeKey(key.id))) router.back();
        },
      },
    ]);

  return (
    <Screen testID="edit-key-screen">
      <ScreenHeader
        title="Edit key"
        subtitle={`${info.label} · ${maskKey(key.key)}`}
        onBack={() => router.back()}
      />

      <View style={styles.group}>
        <TextField
          testID="edit-key-label"
          label="Name"
          value={label}
          onChangeText={setLabel}
          maxLength={60}
          editable={busy === null}
        />
        <Button
          testID="edit-key-save"
          variant="secondary"
          label="Save name"
          onPress={saveLabel}
          loading={busy === 'save'}
          disabled={busy !== null || label.trim() === key.label}
        />
      </View>

      {providerModels.length > 0 ? (
        <View style={styles.group}>
          <AppText variant="label" color="textMuted">
            Model
          </AppText>
          <View style={styles.chips}>
            {providerModels.map((model) => (
              <Chip
                key={model.model_id}
                testID={`model-${model.model_id}`}
                label={model.label}
                selected={model.model_id === selectedModelId}
                disabled={busy !== null}
                onPress={() =>
                  void run('save', () =>
                    updateKey(key.id, { model: model.is_default ? null : model.model_id }),
                  )
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {key.last_error ? (
        <AppText variant="caption" color="danger">
          {key.last_error}
        </AppText>
      ) : null}
      {error ? (
        <AppText testID="edit-key-error" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {notice ? (
        <AppText testID="edit-key-notice" color="success" accessibilityRole="alert">
          {notice}
        </AppText>
      ) : null}

      <View style={styles.group}>
        <Button
          testID="edit-key-check"
          variant="secondary"
          label="Check this key again"
          onPress={checkAgain}
          loading={busy === 'check'}
          disabled={busy !== null}
        />
        <Button
          testID="edit-key-toggle"
          variant="secondary"
          label={key.status === 'disabled' ? 'Turn this key on' : 'Turn this key off'}
          onPress={toggle}
          loading={busy === 'toggle'}
          disabled={busy !== null}
        />
        <Button
          testID="edit-key-delete"
          variant="danger"
          label="Delete key"
          onPress={confirmDelete}
          loading={busy === 'delete'}
          disabled={busy !== null}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
