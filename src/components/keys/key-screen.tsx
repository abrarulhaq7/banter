import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Banner,
  Button,
  Dialog,
  ListRow,
  OptionList,
  Screen,
  ScreenHeader,
  Sheet,
  TextField,
  useToast,
} from '@/components/ui';
import { defaultModelFor, modelsFor, useKeys, type Result } from '@/data';
import { checkKey } from '@/providers/check-key';
import { PROVIDERS, maskKey } from '@/providers/providers';
import { spacing } from '@/theme';

import { KEY_STATUS } from './key-status';

type KeyScreenProps = {
  id: string;
  /** Tests pass a fake checker. */
  check?: typeof checkKey;
};

type Job = 'save' | 'check' | 'toggle' | 'delete';

/** One key: a short menu. Rename and model open a sheet; delete asks first. */
export function KeyScreen({ id, check = checkKey }: KeyScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const { keys, models, updateKey, removeKey } = useKeys();
  const key = keys.find((item) => item.id === id);

  const [sheet, setSheet] = useState<null | 'name' | 'model'>(null);
  const [asking, setAsking] = useState(false);
  const [label, setLabel] = useState('');
  const [labelError, setLabelError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!key) {
    return (
      <Screen testID="edit-key-screen" fill>
        <ScreenHeader title="Key not found" subtitle="It may have been deleted." onBack={() => router.back()} />
      </Screen>
    );
  }

  const info = PROVIDERS[key.provider];
  const state = KEY_STATUS[key.status];
  const providerModels = modelsFor(models, key.provider);
  const selectedModelId = key.model ?? defaultModelFor(models, key.provider)?.model_id ?? null;
  const selectedModel = providerModels.find((model) => model.model_id === selectedModelId);
  const off = key.status === 'disabled';

  const run = async (job: Job, action: () => Promise<Result>, done?: string) => {
    setError(null);
    setBusy(job);
    const result = await action();
    setBusy(null);
    if (!result.ok) setError(result.message);
    else if (done) toast.show(done);
    return result.ok;
  };

  const openName = () => {
    setLabel(key.label);
    setLabelError(null);
    setSheet('name');
  };

  const saveName = async () => {
    const next = label.trim();
    if (!next) return setLabelError('Give the key a name.');
    setSheet(null);
    if (next !== key.label) await run('save', () => updateKey(key.id, { label: next }), 'Saved');
  };

  const pickModel = async (modelId: string) => {
    setSheet(null);
    if (modelId === selectedModelId) return;
    const model = providerModels.find((item) => item.model_id === modelId);
    // Null keeps the key on the provider's default, even if the default changes later.
    await run('save', () => updateKey(key.id, { model: model?.is_default ? null : modelId }), 'Saved');
  };

  const checkAgain = () =>
    run('check', async () => {
      const checked = await check(key.provider, key.key);
      if (checked.ok) {
        // A key that was switched off stays off; checking only clears a bad status.
        const saved = await updateKey(key.id, { status: off ? 'disabled' : 'active', last_error: null });
        if (saved.ok) toast.show(`${info.label} accepted this key`);
        return saved;
      }
      if (checked.reason === 'invalid') {
        await updateKey(key.id, { status: 'invalid', last_error: checked.message });
      }
      return { ok: false, message: checked.message };
    });

  const toggle = () =>
    run(
      'toggle',
      () => updateKey(key.id, { status: off ? 'active' : 'disabled', last_error: null }),
      off ? 'Key turned on' : 'Key turned off',
    );

  const remove = async () => {
    const removed = await run('delete', () => removeKey(key.id));
    setAsking(false);
    if (removed) router.back();
  };

  // One message at a time: what just went wrong, or else what the provider last said.
  const problem = error ?? key.last_error;
  const idle = busy === null;

  return (
    <Screen testID="edit-key-screen" fill>
      <ScreenHeader
        title={key.label}
        titleTestID="edit-key-title"
        subtitle={`${info.label} · ${maskKey(key.key)}`}
        onBack={() => router.back()}
      />

      {problem ? (
        <Banner tone="danger" messageTestID="edit-key-error">
          {problem}
        </Banner>
      ) : null}

      <View style={styles.list}>
        <ListRow
          testID="edit-key-name"
          icon="edit"
          title="Name"
          value={key.label}
          onPress={openName}
          disabled={!idle}
        />
        {providerModels.length > 0 ? (
          <ListRow
            testID="edit-key-model"
            icon="model"
            title="Model"
            value={selectedModel?.label ?? 'Default'}
            onPress={() => setSheet('model')}
            disabled={!idle}
          />
        ) : null}
        <ListRow
          testID="edit-key-toggle"
          icon="power"
          title={off ? 'Turn this key on' : 'Turn this key off'}
          subtitle={`Now: ${state.label}`}
          trailing={<View />}
          onPress={toggle}
          busy={busy === 'toggle'}
          disabled={!idle}
        />
        <ListRow
          testID="edit-key-check"
          icon="checkAgain"
          title="Check this key again"
          subtitle={`Free. Sends the key only to ${info.label}.`}
          trailing={<View />}
          onPress={checkAgain}
          busy={busy === 'check'}
          disabled={!idle}
        />
      </View>

      <ListRow
        testID="edit-key-delete"
        icon="delete"
        tone="danger"
        title="Delete key"
        trailing={<View />}
        onPress={() => setAsking(true)}
        disabled={!idle}
      />

      <Sheet testID="key-name-sheet" visible={sheet === 'name'} title="Name" onClose={() => setSheet(null)}>
        <TextField
          testID="edit-key-label"
          label="Name for this key"
          value={label}
          onChangeText={(value) => {
            setLabel(value);
            setLabelError(null);
          }}
          error={labelError ?? undefined}
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={saveName}
        />
        <View style={styles.sheetActions}>
          <Button style={styles.fill} variant="secondary" label="Cancel" onPress={() => setSheet(null)} />
          <Button testID="edit-key-save" style={styles.fill} label="Save" onPress={saveName} />
        </View>
      </Sheet>

      <Sheet
        testID="key-model-sheet"
        visible={sheet === 'model'}
        title="Model"
        subtitle={`Which ${info.label} model writes your lines with this key.`}
        onClose={() => setSheet(null)}>
        <OptionList
          testIDPrefix="model"
          options={providerModels.map((model) => ({
            value: model.model_id,
            label: model.label,
            subtitle: model.is_default ? 'Recommended' : undefined,
          }))}
          value={selectedModelId}
          onSelect={pickModel}
        />
      </Sheet>

      <Dialog
        visible={asking}
        tone="danger"
        icon="delete"
        title="Delete this key?"
        message={`"${key.label}" will be removed from Banter. Your history is kept.`}
        confirmLabel="Delete"
        busy={busy === 'delete'}
        onConfirm={remove}
        onCancel={() => setAsking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  sheetActions: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
});
