import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  ListRow,
  OptionList,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Sheet,
  TextField,
} from '@/components/ui';
import { defaultModelFor, modelsFor, useKeys } from '@/data';
import type { ProviderId } from '@/lib/database.types';
import { checkKey } from '@/providers/check-key';
import { PROVIDER_IDS, PROVIDERS, guessProvider } from '@/providers/providers';
import { spacing } from '@/theme';

type AddKeyScreenProps = {
  testID: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Called after the key has been checked and saved. */
  onSaved: () => void;
  /** A second way on, under the main button: "Add a key later" in onboarding. */
  secondary?: { label: string; onPress: () => void; loading?: boolean; testID?: string };
  /** A problem from outside the form, shown with the form's own. */
  error?: string | null;
  /** Tests pass a fake checker. */
  check?: typeof checkKey;
};

const PROVIDER_OPTIONS = PROVIDER_IDS.map((id) => ({ value: id, label: PROVIDERS[id].label }));

/**
 * Add a key: pick the provider, paste the key. It is checked before it is saved.
 * Used in Settings and as the last step of onboarding.
 */
export function AddKeyScreen({
  testID,
  title,
  subtitle,
  onBack,
  onSaved,
  secondary,
  error: outsideError,
  check = checkKey,
}: AddKeyScreenProps) {
  const { keys, models, addKey } = useKeys();

  const [provider, setProvider] = useState<ProviderId>('gemini');
  const [providerPicked, setProviderPicked] = useState(false);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [modelId, setModelId] = useState<string | null>(null);
  const [choosingModel, setChoosingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const info = PROVIDERS[provider];
  const providerModels = modelsFor(models, provider);
  const defaultModel = defaultModelFor(models, provider);
  const selectedModelId = modelId ?? defaultModel?.model_id ?? null;
  const selectedModel = providerModels.find((model) => model.model_id === selectedModelId);

  const guessed = guessProvider(key);
  const looksLikeAnother = guessed !== null && guessed !== provider;

  const pickProvider = (next: ProviderId) => {
    setProvider(next);
    setProviderPicked(true);
    setModelId(null);
    setError(null);
  };

  const onKeyChange = (value: string) => {
    setKey(value);
    setError(null);
    // Until the user picks a provider themselves, follow what the key looks like.
    const guess = guessProvider(value);
    if (!providerPicked && guess && guess !== provider) {
      setProvider(guess);
      setModelId(null);
    }
  };

  const pickModel = (next: string) => {
    const model = providerModels.find((item) => item.model_id === next);
    // Null keeps the key on the provider's default, even if the default changes later.
    setModelId(model?.is_default ? null : next);
    setChoosingModel(false);
    setError(null);
  };

  const submit = async () => {
    const trimmed = key.trim();
    if (!trimmed) return setError('Paste your key first.');
    if (/\s/.test(trimmed) || trimmed.length < 8) {
      return setError('This does not look like a complete key. Copy it again and paste all of it.');
    }
    if (keys.some((saved) => saved.key === trimmed)) return setError('You have already added this key.');

    setError(null);
    setBusy(true);
    const checked = await check(provider, trimmed);
    if (!checked.ok) {
      setBusy(false);
      return setError(checked.message);
    }
    if (selectedModelId && !checked.modelIds.includes(selectedModelId)) {
      setBusy(false);
      return setError(
        `The key works, but it cannot use ${selectedModel?.label ?? selectedModelId}. Pick another model.`,
      );
    }

    const saved = await addKey({
      provider,
      key: trimmed,
      label: label.trim() || `${info.label} key`,
      model: modelId,
    });
    setBusy(false);
    if (saved.ok) onSaved();
    else setError(saved.message);
  };

  const problem = error ?? outsideError;

  return (
    <Screen
      testID={testID}
      fill
      footer={
        <>
          <Button testID="key-submit" label="Check and save" onPress={submit} loading={busy} />
          {secondary ? (
            <Button
              testID={secondary.testID}
              variant="ghost"
              label={secondary.label}
              onPress={secondary.onPress}
              loading={secondary.loading}
              disabled={busy}
            />
          ) : null}
        </>
      }>
      <ScreenHeader title={title} subtitle={subtitle} onBack={onBack} />

      <SegmentedControl
        testIDPrefix="provider"
        options={PROVIDER_OPTIONS}
        value={provider}
        onChange={pickProvider}
        disabled={busy}
      />

      <TextField
        testID="key-input"
        label="API key"
        placeholder={`Paste your ${info.label} key`}
        helper={
          looksLikeAnother
            ? `This looks like a ${PROVIDERS[guessed].label} key. Check the provider above.`
            : `Create one at ${info.keyPage}`
        }
        value={key}
        onChangeText={onKeyChange}
        editable={!busy}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="none"
      />

      {problem ? (
        <Banner tone="danger" messageTestID="key-error">
          {problem}
        </Banner>
      ) : null}

      <View style={styles.rows}>
        {providerModels.length > 0 ? (
          <ListRow
            testID="key-model"
            icon="model"
            title="Model"
            value={selectedModel?.label ?? 'Default'}
            onPress={() => setChoosingModel(true)}
            disabled={busy}
          />
        ) : null}
        <TextField
          testID="key-label"
          label="Name for this key (optional)"
          placeholder={`${info.label} key`}
          value={label}
          onChangeText={setLabel}
          editable={!busy}
          maxLength={60}
        />
      </View>

      <AppText variant="caption" color="textMuted">
        Banter checks the key with {info.label} before saving. The check is free and sends the key only
        to {info.label}.
      </AppText>

      <Sheet
        testID="key-model-sheet"
        visible={choosingModel}
        title="Model"
        subtitle={`Which ${info.label} model writes your lines with this key.`}
        onClose={() => setChoosingModel(false)}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.lg },
});
