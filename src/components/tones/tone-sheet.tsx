import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, IconButton, ListRow, Sheet, TextField } from '@/components/ui';
import { useToneVisibility } from '@/prompts/use-tone-visibility';
import { spacing } from '@/theme';

type ToneSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** The tone in use, marked with a tick. */
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  testID?: string;
};

/** From this many tones on, the sheet gets a search field. */
const SEARCH_FROM = 8;

/**
 * Every tone, to pick one, in the user's order. The arrows move a tone up or down (the
 * first ones show first on Generate); the eye shows it on the Generate screen or hides it
 * from there. "New tone" makes one without leaving for My tones first.
 */
export function ToneSheet({ visible, title, subtitle, selectedKey, onSelect, onClose, testID }: ToneSheetProps) {
  const router = useRouter();
  const { hidden, ordered: tones, toggle, move } = useToneVisibility();
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const listed = needle ? tones.filter((tone) => tone.label.toLowerCase().includes(needle)) : tones;

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Sheet testID={testID} visible={visible} title={title} subtitle={subtitle} onClose={close}>
      {tones.length >= SEARCH_FROM ? (
        <TextField
          testID="tone-search"
          label="Search"
          placeholder="Tone name"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {listed.map((tone, index) => {
          const isHidden = hidden.has(tone.key);
          const selected = tone.key === selectedKey;
          return (
            <ListRow
              key={tone.key}
              testID={`tone-option-${tone.key}`}
              icon={selected ? 'check' : 'tone'}
              tone={selected ? 'success' : 'accent'}
              title={tone.label}
              subtitle={tone.definition}
              subtitleOneLine
              accessibilityLabel={tone.label}
              onPress={() => {
                setQuery('');
                onSelect(tone.key);
              }}
              actions={
                <View style={styles.actions}>
                  {/* Moving makes sense in the whole list only, not in search results. */}
                  {needle ? null : (
                    <>
                      <IconButton
                        testID={`tone-up-${tone.key}`}
                        icon="up"
                        label={`Move ${tone.label} up`}
                        disabled={index === 0}
                        onPress={() => move(tone.key, 'up')}
                      />
                      <IconButton
                        testID={`tone-down-${tone.key}`}
                        icon="down"
                        label={`Move ${tone.label} down`}
                        disabled={index === listed.length - 1}
                        onPress={() => move(tone.key, 'down')}
                      />
                    </>
                  )}
                  <IconButton
                    testID={`tone-eye-${tone.key}`}
                    icon={isHidden ? 'hidden' : 'shown'}
                    color={isHidden ? 'textMuted' : 'accent'}
                    label={isHidden ? `Show ${tone.label} on Generate` : `Hide ${tone.label} from Generate`}
                    selected={!isHidden}
                    onPress={() => toggle(tone.key)}
                  />
                </View>
              }
            />
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          testID="tone-learn"
          style={styles.fill}
          variant="secondary"
          icon="screenshot"
          label="From an example"
          onPress={() => {
            close();
            router.push('/tones/learn');
          }}
        />
        <Button
          testID="tone-new"
          style={styles.fill}
          variant="secondary"
          icon="add"
          label="New tone"
          onPress={() => {
            close();
            router.push('/tones/new');
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Shrinks to fit the sheet, and scrolls when there are many tones.
  scroll: { flexGrow: 0, flexShrink: 1 },
  list: { gap: spacing.sm },
  actions: { flexDirection: 'row' },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  fill: { flex: 1 },
});
