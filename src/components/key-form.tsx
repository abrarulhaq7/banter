import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, TextField } from '@/components/ui';
import { defaultModelFor, modelsFor, useKeys } from '@/data';
import type { ProviderId } from '@/lib/database.types';
import { checkKey } from '@/providers/check-key';
import { PROVIDER_IDS, PROVIDERS, guessProvider } from '@/providers/providers';
import { spacing } from '@/theme';

type KeyFormProps = {
  /** Called after the key has been checked and saved. */
  onSaved: () => void;
  /** Tests pass a fake checker. */
  check?: typeof checkKey;
};

/** Add a key: pick the provider, paste the key, name it. It is checked before it is saved. */
export function KeyForm({ onSaved, check = checkKey }: KeyFormProps) {
  const { keys, models, addKey } = useKeys();

  const [provider, setProvider] = useState<ProviderId>('gemini');
  const [providerPicked, setProviderPicked] = useState(false);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [modelId, setModelId] = useState<string | null>(null);
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
      // Null keeps the key on the provider's default, even if the default changes later.
      model: modelId,
    });
    setBusy(false);
    if (saved.ok) onSaved();
    else setError(saved.message);
  };

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <AppText variant="label" color="textMuted">
          Provider
        </AppText>
        <View style={styles.chips}>
          {PROVIDER_IDS.map((id) => (
            <Chip
              key={id}
              testID={`provider-${id}`}
              label={PROVIDERS[id].label}
              selected={id === provider}
              onPress={() => pickProvider(id)}
              disabled={busy}
            />
          ))}
        </View>
      </View>

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

      <TextField
        testID="key-label"
        label="Name for this key (optional)"
        placeholder={`${info.label} key`}
        value={label}
        onChangeText={setLabel}
        editable={!busy}
        maxLength={60}
      />

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
                onPress={() => setModelId(model.is_default ? null : model.model_id)}
                disabled={busy}
              />
            ))}
          </View>
        </View>
      ) : null}

      {error ? (
        <AppText testID="key-error" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      <View style={styles.group}>
        <Button testID="key-submit" label="Check and save" onPress={submit} loading={busy} />
        <AppText variant="caption" color="textMuted">
          Banter checks the key with {info.label} before saving. The check is free and sends the key
          only to {info.label}.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
