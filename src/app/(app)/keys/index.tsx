import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { effectiveModel, useKeys } from '@/data';
import type { ApiKeyRow, KeyStatus } from '@/lib/database.types';
import { PROVIDERS, maskKey } from '@/providers/providers';
import { spacing, type ColorRole } from '@/theme';

const STATUS: Record<KeyStatus, { label: string; color: ColorRole }> = {
  active: { label: 'Active', color: 'success' },
  limited: { label: 'At its limit', color: 'accentAlt' },
  invalid: { label: 'Rejected', color: 'danger' },
  disabled: { label: 'Off', color: 'textMuted' },
};

export default function KeysScreen() {
  const router = useRouter();
  const { keys, models, status, loadError, moveKey } = useKeys();
  const [error, setError] = useState<string | null>(null);

  const move = async (key: ApiKeyRow, direction: 'up' | 'down') => {
    setError(null);
    const result = await moveKey(key.id, direction);
    if (!result.ok) setError(result.message);
  };

  return (
    <Screen testID="keys-screen">
      <ScreenHeader
        title="AI keys"
        subtitle="Keys are tried from the top. When one hits its limit, Banter moves to the next."
        onBack={() => router.back()}
      />

      {loadError ? (
        <AppText variant="caption" color="accentAlt">
          Showing the copy saved on this phone. {loadError}
        </AppText>
      ) : null}
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      {status === 'ready' && keys.length === 0 ? (
        <AppText testID="no-keys" color="textMuted">
          No keys yet.
        </AppText>
      ) : null}

      <View style={styles.list}>
        {keys.map((key, index) => {
          const state = STATUS[key.status];
          const model = effectiveModel(key, models);
          return (
            <Card key={key.id} testID={`key-card-${index}`}>
              <View style={styles.row}>
                <AppText testID={`key-label-${index}`} variant="bodyStrong" style={styles.fill} numberOfLines={1}>
                  {key.label}
                </AppText>
                <AppText testID={`key-status-${index}`} variant="label" color={state.color}>
                  {state.label}
                </AppText>
              </View>
              <AppText variant="caption" color="textMuted">
                {PROVIDERS[key.provider].label}
                {model ? ` · ${model.label}` : ''}
                {key.model === null ? ' (default)' : ''}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {maskKey(key.key)}
              </AppText>
              {key.last_error ? (
                <AppText variant="caption" color="danger">
                  {key.last_error}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <Button
                  testID={`key-up-${index}`}
                  variant="secondary"
                  size="sm"
                  label="Up"
                  disabled={index === 0}
                  onPress={() => move(key, 'up')}
                />
                <Button
                  testID={`key-down-${index}`}
                  variant="secondary"
                  size="sm"
                  label="Down"
                  disabled={index === keys.length - 1}
                  onPress={() => move(key, 'down')}
                />
                <View style={styles.fill} />
                <Button
                  testID={`key-edit-${index}`}
                  variant="ghost"
                  size="sm"
                  label="Edit"
                  onPress={() => router.push({ pathname: '/keys/[id]', params: { id: key.id } })}
                />
              </View>
            </Card>
          );
        })}
      </View>

      <Button testID="add-key" label="Add a key" onPress={() => router.push('/keys/add')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  fill: { flex: 1 },
});
