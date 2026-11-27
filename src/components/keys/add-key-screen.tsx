import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, ListRow, OptionList, Screen, ScreenHeader, Sheet, TextField } from '@/components/ui';
import { modelsFor, useKeys } from '@/data';
import type { ProviderId } from '@/lib/database.types';
import { checkKey } from '@/providers/check-key';
import { PROVIDER_IDS, PROVIDERS, guessProvider } from '@/providers/providers';
import { spacing } from '@/theme';

import { AUTOMATIC, modelOptions } from './model-options';

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

const PROVIDER_OPTIONS = PROVIDER_IDS.map((id) => ({
  value: id,
  label: PROVIDERS[id].label,
  subtitle: PROVIDERS[id].cost,
}));

/**
 * Add a key: paste it, and the provider follows from how it starts (or pick it). It is
 * checked before it is saved. Used in Settings and as the last step of onboarding.
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
  /** Null is automatic: the best model first. */
  const [modelId, setModelId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'provider' | 'model'>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const info = PROVIDERS[provider];
  const providerModels = modelsFor(models, provider);
  const selectedModel = providerModels.find((model) => model.model_id === modelId);

  const guessed = guessProvider(key);
  const looksLikeAnother = guessed !== null && guessed !== provider;

  const pickProvider = (next: ProviderId) => {
    setProvider(next);
    setProviderPicked(true);
    setModelId(null);
    setSheet(null);
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
    setModelId(next === AUTOMATIC ? null : next);
    setSheet(null);
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
    // Providers that list the models a key may use: make sure this key can use ours.
    const allowed = checked.modelIds;
    if (allowed && modelId && !allowed.includes(modelId)) {
      setBusy(false);
      return setError(`The key works, but it cannot use ${selectedModel?.label ?? modelId}. Pick another model.`);
    }
    if (allowed && !modelId && providerModels.length > 0 && !providerModels.some((model) => allowed.includes(model.model_id))) {
      setBusy(false);
      return setError(`The key works, but it cannot use any of the ${info.label} models Banter offers.`);
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

      <ListRow
        testID="key-provider"
        icon="key"
        title="Provider"
        value={info.label}
        onPress={() => setSheet('provider')}
        disabled={busy}
      />

      <TextField
        testID="key-input"
        label="API key"
        placeholder={`Paste your ${info.label} key`}
        helper={
          looksLikeAnother
            ? `This looks like a ${PROVIDERS[guessed].label} key. Check the provider.`
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
            value={selectedModel?.label ?? 'Automatic'}
            onPress={() => setSheet('model')}
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
        testID="key-provider-sheet"
        visible={sheet === 'provider'}
        title="Provider"
        subtitle="Who made the key. Banter fills this in from how the key starts."
        onClose={() => setSheet(null)}>
        <OptionList testIDPrefix="provider" options={PROVIDER_OPTIONS} value={provider} onSelect={pickProvider} />
      </Sheet>

      <Sheet
        testID="key-model-sheet"
        visible={sheet === 'model'}
        title="Model"
        subtitle={`Which ${info.label} model writes your lines with this key.`}
        onClose={() => setSheet(null)}>
        <OptionList
          testIDPrefix="model"
          options={modelOptions(providerModels)}
          value={modelId ?? AUTOMATIC}
          onSelect={pickModel}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.lg },
});
