import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, Button, EmptyState, IconButton, ListRow, Screen, ScreenHeader } from '@/components/ui';
import { effectiveModel, useKeys } from '@/data';
import type { ApiKeyRow } from '@/lib/database.types';
import { PROVIDERS } from '@/providers/providers';
import { spacing } from '@/theme';

import { KEY_STATUS } from './key-status';

/** Settings > AI keys: one short row per key, in the order they are tried. A row opens its key. */
export function KeysScreen() {
  const router = useRouter();
  const { keys, models, status, loadError, moveKey } = useKeys();
  const [error, setError] = useState<string | null>(null);

  const move = async (key: ApiKeyRow, direction: 'up' | 'down') => {
    setError(null);
    const result = await moveKey(key.id, direction);
    if (!result.ok) setError(result.message);
  };

  return (
    <Screen
      testID="keys-screen"
      footer={<Button testID="add-key" icon="add" label="Add a key" onPress={() => router.push('/keys/add')} />}>
      <ScreenHeader
        title="AI keys"
        subtitle="Tried from the top. When one hits its limit, Banter moves to the next."
        onBack={() => router.back()}
      />

      {loadError ? <Banner tone="warning">{`Showing the copy saved on this phone. ${loadError}`}</Banner> : null}
      {error ? (
        <Banner tone="danger" messageTestID="keys-error">
          {error}
        </Banner>
      ) : null}

      {status === 'ready' && keys.length === 0 ? (
        <EmptyState
          testID="no-keys"
          icon="key"
          title="No keys yet"
          message="Banter writes lines with your own key from Gemini, OpenAI or Claude."
        />
      ) : null}

      <View style={styles.list}>
        {keys.map((key, index) => {
          const state = KEY_STATUS[key.status];
          const model = effectiveModel(key, models);
          return (
            <ListRow
              key={key.id}
              testID={`key-card-${index}`}
              icon="key"
              tone={state.tone}
              title={key.label}
              subtitle={`${state.label} · ${model?.label ?? PROVIDERS[key.provider].label}`}
              onPress={() => router.push({ pathname: '/keys/[id]', params: { id: key.id } })}
              actions={
                keys.length > 1 ? (
                  <View style={styles.order}>
                    <IconButton
                      testID={`key-up-${index}`}
                      icon="up"
                      label={`Move ${key.label} up`}
                      disabled={index === 0}
                      onPress={() => move(key, 'up')}
                    />
                    <IconButton
                      testID={`key-down-${index}`}
                      icon="down"
                      label={`Move ${key.label} down`}
                      disabled={index === keys.length - 1}
                      onPress={() => move(key, 'down')}
                    />
                  </View>
                ) : null
              }
            />
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  order: { flexDirection: 'row' },
});
