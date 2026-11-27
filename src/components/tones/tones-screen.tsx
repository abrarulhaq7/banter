import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, Button, ListRow, Screen, ScreenHeader } from '@/components/ui';
import { usePrompts, type Tone } from '@/prompts';
import { useToneVisibility } from '@/prompts/use-tone-visibility';
import { spacing } from '@/theme';

const KIND_LABEL: Record<Tone['kind'], string | undefined> = {
  default: undefined,
  edited: 'Edited',
  custom: 'Yours',
};

/** The My tones tab: every tone as one short row. A row opens the tone to change it. */
export function TonesScreen() {
  const router = useRouter();
  const { loadError, refresh } = usePrompts();
  // In the user's order, the same as on Generate (set with the arrows in the Tones sheet).
  const { hidden, ordered: tones } = useToneVisibility();

  // Opening the tab is a good moment to pick up a default that was changed in Supabase.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen
      testID="tones-screen"
      edges={['top', 'left', 'right']}
      footer={<Button testID="add-tone" icon="add" label="Add a tone" onPress={() => router.push('/tones/new')} />}>
      <ScreenHeader title="My tones" subtitle="How each tone should sound. Change one, or add your own." />

      {loadError ? (
        <Banner testID="tones-offline" tone="info" title="Showing the copy saved on this phone">
          {loadError}
        </Banner>
      ) : null}

      <ListRow
        testID="personalise-row"
        icon="generate"
        title="Personalise for me"
        subtitle="The AI suggests changes from how your lines went."
        onPress={() => router.push('/tones/personalise')}
      />
      <ListRow
        testID="learn-row"
        icon="screenshot"
        title="Learn from an example"
        subtitle="Show it a line you liked. It makes a tone that writes like that."
        onPress={() => router.push('/tones/learn')}
      />

      <View style={styles.list}>
        {tones.map((tone) => (
          <ListRow
            key={tone.key}
            testID={`tone-row-${tone.key}`}
            icon={tone.kind === 'custom' ? 'edit' : 'tone'}
            title={tone.label}
            subtitle={tone.definition}
            value={hidden.has(tone.key) ? 'Hidden' : KIND_LABEL[tone.kind]}
            onPress={() => router.push({ pathname: '/tones/[key]', params: { key: tone.key } })}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
